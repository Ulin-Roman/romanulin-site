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

if (typeof document !== 'undefined') {
    const campaigns = document.querySelectorAll('[data-campaign-until]');
    const syncCampaigns = () => campaigns.forEach(block => {
        block.hidden = !campaignIsActive(block.dataset.campaignUntil);
    });
    syncCampaigns();
    // A timer also covers pages left open across midnight; no expired-content flash.
    let expiryTimer;
    const scheduleExpiry = () => {
        clearTimeout(expiryTimer);
        syncCampaigns();
        const remaining = [...campaigns].map(block => Date.parse(block.dataset.campaignUntil) - Date.now()).filter(ms => ms > 0);
        if (remaining.length) expiryTimer = setTimeout(scheduleExpiry, Math.min(...remaining, 2147483647));
    };
    scheduleExpiry();
    document.addEventListener('visibilitychange', scheduleExpiry);
    window.addEventListener('pageshow', scheduleExpiry);

    const stats = document.querySelector('[data-tgstat]');
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
            stats.querySelectorAll('[data-metric]').forEach(el => {
                el.textContent = formatMetric(el.dataset.metric, data.metrics[el.dataset.metric]);
            });
            status.textContent = data.stale ? 'Показаны последние полученные данные канала @direct_ulin' : 'Данные канала @direct_ulin';
            updated.textContent = timestamp;
            updated.hidden = false;
        } catch {
            status.textContent = 'Статистика временно недоступна. Актуальные показатели можно уточнить у Романа.';
            stats.querySelectorAll('[data-metric]').forEach(el => { el.textContent = '—'; });
        } finally {
            clearTimeout(timeout);
            stats.setAttribute('aria-busy', 'false');
            stats.querySelectorAll('[data-metric]').forEach(el => {
                el.classList.remove('is-loading');
                el.removeAttribute('aria-label');
            });
        }
    }
    loadStats();

    // Empty by default. Only real publications supplied by the owner belong here.
    async function loadExamples() {
        try {
            const response = await fetch(new URL('../data/reklama-examples.json', import.meta.url));
            if (!response.ok) return;
            const examples = await response.json();
            if (!Array.isArray(examples)) return;
            const list = document.querySelector('[data-examples-list]');
            const template = document.querySelector('#placement-example-template');
            for (const example of examples) {
                if (!example.title || !example.description || typeof example.url !== 'string') continue;
                const url = new URL(example.url);
                if (url.origin !== 'https://t.me' || !/^\/direct_ulin\/\d+$/.test(url.pathname)) continue;
                const card = template.content.cloneNode(true);
                card.querySelector('h3').textContent = example.title;
                card.querySelector('p').textContent = example.description;
                card.querySelector('a').href = url.href;
                list.append(card);
            }
            document.querySelector('#placement-examples').hidden = !list.children.length;
        } catch {
            // An empty or unavailable examples catalog is intentionally invisible.
        }
    }
    loadExamples();
}
