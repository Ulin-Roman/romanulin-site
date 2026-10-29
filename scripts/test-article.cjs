const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const article = fs.readFileSync(path.join(__dirname, '../js/article.js'), 'utf8');
const site = fs.readFileSync(path.join(__dirname, '../js/site.js'), 'utf8');
const copyStart = article.indexOf('        const copyArticleLink = async () => {');
const copyEnd = article.indexOf("        const articleBody = blogArticle.querySelector('.article-body');", copyStart);
assert.ok(copyStart >= 0 && copyEnd > copyStart, 'share component must be found');
const shareSource = article.slice(copyStart, copyEnd);

function shareFixture(options = {}) {
    const classes = new Set();
    const attributes = { 'aria-label': 'Поделиться статьёй' };
    const label = { textContent: 'Поделиться' };
    const timers = [];
    const calls = { clipboard: 0, legacy: 0, removed: 0, share: 0 };
    let click;
    const shareButton = {
        title: 'Поделиться',
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
        },
        querySelector: () => label,
        setAttribute: (name, value) => { attributes[name] = value; },
        addEventListener: (type, callback) => { if (type === 'click') click = callback; }
    };
    const navigator = {};
    if (!options.noClipboard) {
        navigator.clipboard = { writeText: async () => {
            calls.clipboard++;
            if (options.clipboardDenied) throw Error('Clipboard denied');
        } };
    }
    if (options.nativeShare) {
        navigator.share = async () => {
            calls.share++;
            if (options.nativeShare === 'abort') throw Object.assign(Error('Cancelled'), { name: 'AbortError' });
            if (options.nativeShare === 'fail') throw Error('Native share unavailable');
        };
    }
    const document = {
        title: 'Статья',
        querySelector: () => ({ textContent: 'Заголовок статьи' }),
        createElement: () => ({
            setAttribute() {}, style: {}, select() {},
            remove() { calls.removed++; }
        }),
        body: { append() {} },
        execCommand: () => {
            calls.legacy++;
            if (options.legacyThrows) throw Error('Legacy copy denied');
            return options.legacyResult ?? true;
        }
    };
    vm.runInNewContext(shareSource, {
        canonicalUrl: 'https://romanulin.ru/blog/test/',
        navigator, document, shareButton,
        window: { setTimeout: callback => { timers.push(callback); return timers.length; } }
    });
    assert.equal(typeof click, 'function');
    return { click, calls, classes, attributes, label, shareButton, timers };
}

function feedFixture(value, initialState = { keep: 'existing' }) {
    const begin = article.indexOf('            window.requestAnimationFrame(() => {');
    const finish = article.indexOf('\n            });', begin) + '\n            });'.length;
    assert.ok(begin >= 0 && finish > begin, 'article URL cleanup must be found');
    const prefixEnd = site.indexOf('const readBlogScrollPosition');
    assert.ok(prefixEnd > 0);
    const prefix = site.slice(0, prefixEnd) + '\nincomingBlogScrollPosition;';
    const address = new URL('https://romanulin.ru/blog/test/?other=kept#section');
    if (value !== null) address.searchParams.set('feedScroll', value);
    let frame;
    const window = {
        location: { href: address.href, protocol: address.protocol, pathname: address.pathname },
        history: { state: initialState, replaceState(state, _, url) {
            this.state = state;
            window.location.href = url;
        } },
        requestAnimationFrame: callback => { frame = callback; }
    };
    const document = { querySelector: () => null };
    const readIncoming = () => vm.runInNewContext(prefix, { window, document, URL });
    const incomingBeforeFrame = readIncoming();
    vm.runInNewContext(article.slice(begin, finish), {
        window, document, URL, relatedArticlesList: { scrollTop: 120 }
    });
    assert.equal(typeof frame, 'function');
    frame(); // The next external script has not loaded yet.
    return { window, incomingBeforeFrame, incomingAfterFrame: readIncoming(), url: new URL(window.location.href) };
}

(async () => {
    const direct = shareFixture();
    await direct.click();
    assert.equal(direct.calls.clipboard, 1);
    assert.equal(direct.calls.legacy, 0);
    assert.ok(direct.classes.has('is-copied'));
    assert.equal(direct.label.textContent, 'Ссылка скопирована');
    direct.timers[0]();
    assert.equal(direct.label.textContent, 'Поделиться');
    assert.equal(direct.attributes['aria-label'], 'Поделиться статьёй');
    assert.equal(direct.shareButton.title, 'Поделиться');
    assert.ok(!direct.classes.has('is-copied'));

    const legacy = shareFixture({ clipboardDenied: true });
    await legacy.click();
    assert.equal(legacy.calls.clipboard, 1);
    assert.equal(legacy.calls.legacy, 1);
    assert.equal(legacy.calls.removed, 1);
    assert.ok(legacy.classes.has('is-copied'));

    for (const options of [
        { clipboardDenied: true, legacyResult: false },
        { noClipboard: true, legacyThrows: true }
    ]) {
        const failed = shareFixture(options);
        await failed.click(); // No unhandled rejection on either fallback failure.
        assert.equal(failed.calls.legacy, 1, 'copy must not be retried unconditionally');
        assert.equal(failed.calls.removed, 1, 'temporary textarea must always be removed');
        assert.ok(!failed.classes.has('is-copied'));
        assert.equal(failed.label.textContent, 'Не удалось скопировать ссылку');
        assert.equal(failed.attributes['aria-label'], 'Не удалось скопировать ссылку');
    }

    for (const state of ['success', 'abort']) {
        const native = shareFixture({ nativeShare: state });
        await native.click();
        assert.equal(native.calls.share, 1);
        assert.equal(native.calls.clipboard, 0);
        assert.equal(native.calls.legacy, 0);
        assert.equal(native.timers.length, 0, 'native share success/cancel must not show copy feedback');
    }
    const nativeFailure = shareFixture({ nativeShare: 'fail' });
    await nativeFailure.click();
    assert.equal(nativeFailure.calls.share, 1);
    assert.equal(nativeFailure.calls.clipboard, 1);
    assert.ok(nativeFailure.classes.has('is-copied'));

    const valid = feedFixture('3600');
    assert.equal(valid.incomingBeforeFrame, 3600);
    assert.equal(valid.incomingAfterFrame, 3600, 'RAF before site.js must preserve the URL fallback');
    assert.equal(valid.window.history.state.feedScroll, 3600);
    assert.equal(valid.window.history.state.keep, 'existing');
    assert.ok(!valid.url.searchParams.has('feedScroll'));
    assert.equal(valid.url.searchParams.get('other'), 'kept');
    assert.equal(valid.url.hash, '#section');

    for (const value of ['-1', 'NaN', 'Infinity']) {
        const invalid = feedFixture(value);
        assert.equal(invalid.incomingAfterFrame, null);
        assert.ok(!Object.hasOwn(invalid.window.history.state, 'feedScroll'));
        assert.equal(invalid.window.history.state.keep, 'existing');
        assert.ok(!invalid.url.searchParams.has('feedScroll'));
    }
    const historyFallback = feedFixture(null, { feedScroll: 450, keep: 'existing' });
    assert.equal(historyFallback.incomingAfterFrame, 450);
    console.log('PASS: article sharing success/failure/cancel, fallback cleanup, feedback and feedScroll script-loading race.');
})().catch(error => { console.error(error); process.exitCode = 1; });
