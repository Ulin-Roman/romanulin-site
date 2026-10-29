const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || path.resolve(__dirname, '..');
const site = fs.readFileSync(process.argv[3] || path.join(root, 'js/site.js'), 'utf8');
const css = fs.readFileSync(process.argv[4] || path.join(root, 'css/winter.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const listMarkup = html.match(/<ol class="services-list">([\s\S]*?)<\/ol>/)?.[1];
assert.ok(listMarkup, 'services must remain an ordered list');
const markupItems = [...listMarkup.matchAll(/<li([^>]*)><span>([\s\S]*?)<\/span><div><strong>([\s\S]*?)<\/strong><p>([\s\S]*?)<\/p><\/div><\/li>/g)];
assert.equal(markupItems.length, 9);
assert.ok(markupItems.every(m => !/\brole=/.test(m[1])));
const start = site.indexOf('if (serviceItems.length) {');
const finish = site.indexOf('\nconst scrollTopButton', start);
assert.ok(start >= 0 && finish > start);
const source = site.slice(start, finish);

class Element {
    constructor(tagName) { this.tagName = tagName.toUpperCase(); this.children = []; this.attributes = new Map(); this.events = new Map(); this.parent = null; this.textContent = ''; const classes = new Set(); this.classList = { contains: x => classes.has(x), remove: x => classes.delete(x), add: x => classes.add(x), toggle: (x, enabled) => enabled ? classes.add(x) : classes.delete(x) }; }
    get id() { return this.getAttribute('id') || ''; }
    set id(value) { this.setAttribute('id', value); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    append(...children) { children.forEach(child => { this.children.push(child); child.parent = this; }); }
    querySelector(selector) { return this.children.flatMap(child => [child, ...child.descendants()]).find(child => selector === 'p' ? child.tagName === 'P' : selector === 'strong' ? child.tagName === 'STRONG' : false) || null; }
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
    closest(selector) { if (selector === '.services-list li') { for (let node = this; node; node = node.parent) if (node.tagName === 'LI') return node; } return null; }
    addEventListener(type, callback) { this.events.set(type, (this.events.get(type) || []).concat(callback)); }
    dispatch(type, event = {}) { event.target ||= this; event.preventDefault ||= () => { event.defaultPrevented = true; }; for (const callback of this.events.get(type) || []) callback(event); this.parent?.dispatch(type, event); return event; }
    click() { this.dispatch('click'); }
    nativeActivate(key) { const down = this.dispatch('keydown', { key }); if (key === 'Enter' && !down.defaultPrevented) this.click(); const up = this.dispatch('keyup', { key }); if (key === ' ' && !down.defaultPrevented && !up.defaultPrevented) this.click(); }
}
function fixture(mobile = true, empty = false) {
    const document = new Element('document');
    document.createElement = tag => new Element(tag);
    const list = new Element('ol'); document.append(list);
    const items = empty ? [] : markupItems.map(match => {
        const item = new Element('li'); const number = new Element('span'); number.textContent = match[2];
        const content = new Element('div'); const heading = new Element('strong'); heading.textContent = match[3];
        const description = new Element('p'); description.textContent = match[4]; content.append(heading, description); item.append(number, content); list.append(item);
        item.setAttribute('role', 'button'); item.setAttribute('tabindex', '0'); item.setAttribute('aria-expanded', 'false');
        return item;
    });
    const media = { matches: mobile, addEventListener(type, listener) { assert.equal(type, 'change'); this.listener = listener; } };
    vm.runInNewContext(source, { serviceItems: items, mobileServicesLayout: media, document });
    return { document, items, buttons: items.map(item => item.children.find(child => child.tagName === 'BUTTON')), resize(value) { media.matches = value; media.listener?.(); } };
}
const state = (f, index) => f.buttons[index].getAttribute('aria-expanded');
const f = fixture();
const ids = new Set();
f.items.forEach((item, i) => {
    assert.equal(item.getAttribute('role'), null); assert.equal(item.getAttribute('tabindex'), null); assert.equal(item.getAttribute('aria-expanded'), null);
    assert.equal(item.children[0].tagName, 'SPAN'); assert.equal(item.children[1].tagName, 'DIV'); assert.equal(item.children.length, 3);
    const button = f.buttons[i]; assert.ok(button); assert.equal(button.type, 'button'); assert.equal(button.className, 'service-toggle');
    assert.equal(button.getAttribute('aria-label'), item.querySelector('strong').textContent);
    assert.equal(button.getAttribute('aria-controls'), item.querySelector('p').id); ids.add(button.getAttribute('aria-controls'));
    assert.equal(state(f, i), 'false'); assert.equal((item.events.get('keydown') || []).length, 0); assert.equal(item.events.get('click').length, 1);
});
assert.equal(ids.size, 9);
f.buttons[0].click(); assert.equal(state(f, 0), 'true'); f.buttons[0].click(); assert.equal(state(f, 0), 'false');
f.buttons[0].nativeActivate('Enter'); assert.equal(state(f, 0), 'true', 'native Enter must toggle only once');
f.buttons[0].nativeActivate(' '); assert.equal(state(f, 0), 'false', 'native Space must toggle only once');
f.buttons[0].click(); f.buttons[1].click(); assert.equal(state(f, 0), 'false'); assert.equal(state(f, 1), 'true');
f.document.dispatch('keydown', { key: 'Escape' }); assert.ok(f.buttons.every(button => button.getAttribute('aria-expanded') === 'false'));
f.buttons[2].click(); f.document.dispatch('click', { target: new Element('aside') }); assert.equal(state(f, 2), 'false');
f.buttons[3].click(); f.resize(false); assert.ok(f.items.every(item => !item.classList.contains('is-open'))); assert.ok(f.buttons.every(button => button.getAttribute('aria-expanded') === 'false'));
f.buttons[0].click(); assert.equal(state(f, 0), 'false', 'desktop service cards must not toggle');
f.resize(true); f.buttons[0].nativeActivate('Enter'); assert.equal(state(f, 0), 'true');
fixture(false); fixture(true, true);
assert.match(css, /\.services-list \.service-toggle \{ display: none; \}/);
assert.match(css, /\.services-list \.service-toggle \{ position: absolute; z-index: 2; inset: 0; display: block;/);
assert.match(css, /\.services-list \.service-toggle:focus-visible \{ outline:/);
assert.ok(!css.includes('.services-list li:focus-visible'));
console.log('PASS: nine native service buttons preserve list semantics, direct-child layout, names/controls, single native Enter/Space clicks, exclusive opening, outside/Escape close, mobile/desktop state and focus styles.');
