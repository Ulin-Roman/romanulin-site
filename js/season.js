(function () {
    'use strict';
    const moscow = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    const promotionStart = Date.parse('2026-10-29T00:00:00+03:00');
    const promotionEnd = Date.parse('2026-10-29T23:00:00+03:00');
    const boundaries = new Map();
    const parts = timestamp => Object.fromEntries(moscow.formatToParts(timestamp)
        .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));

    function midnight(year, month, day) {
        const key = `${year}-${month}-${day}`;
        if (boundaries.has(key)) return boundaries.get(key);
        const wallTime = Date.UTC(year, month - 1, day);
        let timestamp = wallTime;
        // Resolve Moscow wall time without depending on the visitor's local timezone.
        for (let attempt = 0; attempt < 3; attempt++) {
            const p = parts(timestamp);
            const observed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
            const corrected = timestamp + wallTime - observed;
            if (corrected === timestamp) break;
            timestamp = corrected;
        }
        boundaries.set(key, timestamp);
        return timestamp;
    }

    function getSeasonState(timestamp = Date.now()) {
        if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) throw new RangeError('Invalid timestamp');
        const year = parts(timestamp).year;
        const januaryEnd = midnight(year, 1, 13);
        const decemberStart = midnight(year, 12, 13);
        let active;
        let nextChange;
        if (timestamp < januaryEnd) {
            active = true;
            nextChange = januaryEnd;
        } else if (timestamp < decemberStart) {
            active = false;
            nextChange = decemberStart;
        } else {
            active = true;
            nextChange = midnight(year + 1, 1, 13);
        }
        if (timestamp >= promotionStart && timestamp < promotionEnd) {
            return { active: true, nextChange: promotionEnd };
        }
        if (timestamp < promotionStart && promotionStart < nextChange) nextChange = promotionStart;
        return { active, nextChange };
    }

    if (typeof module === 'object' && module.exports) module.exports = { getSeasonState };
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.holidaySeason) {
        window.holidaySeason.refresh();
        return;
    }
    const maxDelay = 24 * 60 * 60 * 1000;
    let timer = null;
    let state = getSeasonState(Date.now());

    function armTimer(now) {
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(refresh, Math.max(1, Math.min(maxDelay, state.nextChange - now)));
    }
    function refresh() {
        const now = Date.now();
        const next = getSeasonState(now);
        const changed = next.active !== state.active;
        state = next;
        document.documentElement.classList.toggle('is-holiday-season', state.active);
        armTimer(now);
        if (changed) window.dispatchEvent(new window.CustomEvent('holidayseasonchange', { detail: { active: state.active } }));
        return { ...state };
    }
    window.holidaySeason = {
        get active() { return state.active; },
        get nextChange() { return state.nextChange; },
        refresh
    };
    document.documentElement.classList.toggle('is-holiday-season', state.active);
    armTimer(Date.now());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
})();
