const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const repositoryFile = path.join(__dirname, '../js/season.js');
const sourceFile = fs.existsSync(repositoryFile) ? repositoryFile : path.join(__dirname, 'season.js');
const { getSeasonState } = require(sourceFile);
const code = fs.readFileSync(sourceFile, 'utf8');
const at = value => Date.parse(value);
const promotionStart = at('2026-10-29T00:00:00+03:00');
const promotionEnd = at('2026-10-29T23:00:00+03:00');
const midnight = (year, month, day) => Date.UTC(year, month - 1, day - 1, 21);
const check = (timestamp, active, nextChange) => {
    assert.deepEqual(getSeasonState(timestamp), { active, nextChange });
    assert.ok(nextChange > timestamp, 'next transition must be in the future');
};
check(promotionStart - 1, false, promotionStart);
check(promotionStart, true, promotionEnd);
check(promotionEnd - 1, true, promotionEnd);
check(promotionEnd, false, midnight(2026, 12, 13));
check(promotionEnd + 1, false, midnight(2026, 12, 13));
for (let year = 2026; year <= 2030; year++) {
    const end = midnight(year, 1, 13);
    const start = midnight(year, 12, 13);
    check(end - 1, true, end);
    check(end, false, year === 2026 ? promotionStart : start);
    check(end + 1, false, year === 2026 ? promotionStart : start);
    check(start - 1, false, start);
    check(start, true, midnight(year + 1, 1, 13));
    check(start + 1, true, midnight(year + 1, 1, 13));
    check(at(`${year}-12-31T23:59:59+03:00`), true, midnight(year + 1, 1, 13));
}
const previousTimezone = process.env.TZ;
try {
    for (const timezone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Europe/Moscow']) {
        process.env.TZ = timezone;
        check(promotionEnd, false, midnight(2026, 12, 13));
        check(midnight(2027, 1, 13) - 1, true, midnight(2027, 1, 13));
        check(midnight(2030, 12, 13), true, midnight(2031, 1, 13));
    }
} finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
}
assert.throws(() => getSeasonState(NaN), RangeError);
assert.doesNotMatch(code, /URLSearchParams|location\.search|localStorage|sessionStorage/);

function browser(initialTime) {
    let now = initialTime;
    let id = 0;
    const timers = new Map();
    const events = [];
    const classes = new Set();
    const listeners = { window: new Map(), document: new Map() };
    const listen = (target, type, callback) => {
        const list = listeners[target].get(type) || [];
        list.push(callback);
        listeners[target].set(type, list);
    };
    class MockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    class MockEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
    const window = {
        CustomEvent: MockEvent,
        setTimeout(callback, delay) { timers.set(++id, { callback, delay }); return id; },
        clearTimeout(timer) { timers.delete(timer); },
        addEventListener(type, callback) { listen('window', type, callback); },
        dispatchEvent(event) { events.push(event); return true; }
    };
    const document = {
        documentElement: { classList: { toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } } },
        addEventListener(type, callback) { listen('document', type, callback); }
    };
    const context = vm.createContext({ Date: MockDate, Intl, window, document });
    vm.runInContext(code, context);
    return {
        window, timers, events, classes, context,
        setTime(value) { now = value; },
        fire(target, type) { for (const fn of listeners[target].get(type) || []) fn(); },
        runTimer() { const [key, timer] = timers.entries().next().value; timers.delete(key); timer.callback(); },
        delay() { assert.equal(timers.size, 1); return timers.values().next().value.delay; }
    };
}
const page = browser(promotionEnd - 10);
assert.equal(page.window.holidaySeason.active, true);
assert.equal(page.classes.has('is-holiday-season'), true);
assert.equal(page.events.length, 0, 'initial state must not dispatch change');
assert.equal(page.delay(), 10);
page.setTime(promotionEnd);
page.runTimer();
assert.equal(page.window.holidaySeason.active, false);
assert.equal(page.classes.has('is-holiday-season'), false);
assert.equal(page.events.length, 1);
assert.equal(page.events[0].type, 'holidayseasonchange');
assert.equal(page.events[0].detail.active, false);
assert.equal(page.delay(), 86400000, 'long timeout is capped at 24 hours');
page.window.holidaySeason.refresh();
assert.equal(page.events.length, 1, 'unchanged state must not dispatch');
assert.equal(page.timers.size, 1, 'refresh must replace, not multiply timers');
page.setTime(midnight(2026, 12, 13));
page.fire('document', 'visibilitychange');
assert.equal(page.window.holidaySeason.active, true, 'wake after throttled timer must refresh');
assert.equal(page.events.length, 2);
page.setTime(midnight(2027, 1, 13));
page.fire('window', 'pageshow');
assert.equal(page.window.holidaySeason.active, false, 'BFCache restore must refresh');
assert.equal(page.events.length, 3);
vm.runInContext(code, page.context);
assert.equal(page.events.length, 3);
assert.equal(page.timers.size, 1, 'duplicate loading must reuse the controller');
const december = browser(midnight(2028, 12, 13) - 1);
assert.equal(december.delay(), 1);
december.setTime(midnight(2028, 12, 13));
december.runTimer();
assert.equal(december.window.holidaySeason.active, true);
assert.equal(december.window.holidaySeason.nextChange, midnight(2029, 1, 13));
console.log('PASS: Moscow seasonal boundaries 2026–2030, one-time promotion, next year, timezone independence, timer cap, change events, wakeup/BFCache and duplicate initialization.');
