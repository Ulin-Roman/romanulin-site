// Public UI only: credentials and the TGStat request remain on the server.
export function campaignIsActive(until, now = Date.now()) {
    const expires = Date.parse(until);
    return Number.isFinite(expires) && now < expires;
}
export function formatMetric(key, value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
    if (key === 'err_percent' || key === 'err24_percent') return value.toFixed(1) + '%';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: key === 'ci_index' ? 2 : 0 }).format(value);
}
export function formatUpdatedAt(value, now = new Date()) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const zone = { timeZone: 'Europe/Moscow' };
    const day = new Intl.DateTimeFormat('en-CA', { ...zone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const today = day.format(date) === day.format(now);
    const label = today ? 'сегодня' : new Intl.DateTimeFormat('ru-RU', { ...zone, day: 'numeric', month: 'long', ...(date.getUTCFullYear() !== now.getUTCFullYear() ? { year: 'numeric' } : {}) }).format(date);
    const time = new Intl.DateTimeFormat('ru-RU', { ...zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    return 'Последнее обновление: ' + label + ', ' + time;
}
export function reachPercent(value, participants) {
    if (![value, participants].every(item => typeof item === 'number' && Number.isFinite(item)) || participants <= 0 || value < 0) return 0;
    return Math.min(100, Math.max(0, value / participants * 100));
}
if (typeof document !== 'undefined') {
    document.querySelectorAll('.metric-help').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            const open = button.getAttribute('aria-expanded') === 'true';
            document.querySelectorAll('.metric-help[aria-expanded="true"]').forEach(item => item.setAttribute('aria-expanded', 'false'));
            button.setAttribute('aria-expanded', String(!open));
        });
    });
    document.addEventListener('click', () => document.querySelectorAll('.metric-help[aria-expanded="true"]').forEach(item => item.setAttribute('aria-expanded', 'false')));
    const stats = document.querySelector('[data-tgstat]');
    function drawCharts(metrics) {
        const participants = metrics.participants_count;
        document.querySelectorAll('[data-chart-label]').forEach(el => {
            el.textContent = formatMetric(el.dataset.chartLabel, metrics[el.dataset.chartLabel]);
        });
        document.querySelectorAll('[data-chart-bar]').forEach(el => {
            const key = el.dataset.chartBar;
            const percent = key === 'participants_count' ? 100 : reachPercent(metrics[key], participants);
            el.style.setProperty('--bar', percent.toFixed(2) + '%');
        });
        document.querySelectorAll('[data-gauge]').forEach(el => {
            const value = metrics[el.dataset.gauge];
            const percent = typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
            el.style.setProperty('--gauge', (percent * 3.6).toFixed(2) + 'deg');
        });
    }
    async function loadStats() {
        if (!stats) return;
        const status = stats.querySelector('[data-stat-status]');
        const updated = stats.querySelector('[data-stat-updated]');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(new URL('../api/tgstat.php', import.meta.url), { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) throw new Error('Unavailable');
            const data = await response.json();
            if (!data.metrics || !data.updatedAt) throw new Error('Unavailable');
            const timestamp = formatUpdatedAt(data.updatedAt);
            if (!timestamp) throw new Error('Unavailable');
            stats.querySelectorAll('[data-metric]').forEach(el => { el.textContent = formatMetric(el.dataset.metric, data.metrics[el.dataset.metric]); });
            drawCharts(data.metrics);
            status.textContent = data.stale ? 'Показаны последние полученные данные канала @direct_ulin' : 'Данные канала @direct_ulin';
            updated.textContent = timestamp;
            updated.hidden = false;
        } catch {
            status.textContent = 'Статистика временно недоступна. Актуальные показатели можно посмотреть в TGStat.';
            stats.querySelectorAll('[data-metric],[data-chart-label]').forEach(el => { el.textContent = '—'; });
        } finally {
            clearTimeout(timeout);
            stats.setAttribute('aria-busy', 'false');
            stats.querySelectorAll('[data-metric]').forEach(el => { el.classList.remove('is-loading'); el.removeAttribute('aria-label'); });
        }
    }
    loadStats();
}