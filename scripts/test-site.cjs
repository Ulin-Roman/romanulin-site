const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', '.romanulin-private', 'node_modules']);
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
});
const htmlFiles = walk(root).filter(file => file.toLowerCase().endsWith('.html'));
const count = (html, regex) => (html.match(regex) || []).length;
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1];
const localTarget = (htmlFile, value) => {
    if (!value || /^(?:#|data:|mailto:|tel:|javascript:)/i.test(value)) return null;
    let pathname = value;
    if (/^https?:\/\//i.test(value)) {
        const url = new URL(value);
        if (!/(?:^|\.)romanulin\.ru$/i.test(url.hostname)) return null;
        pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        return path.join(root, pathname || 'index.html');
    }
    pathname = decodeURIComponent(value.split(/[?#]/)[0]);
    if (!pathname) return null;
    const target = pathname.startsWith('/') ? path.join(root, pathname.replace(/^\/+/, '')) : path.resolve(path.dirname(htmlFile), pathname);
    return /[\\\/]$/.test(pathname) ? path.join(target, 'index.html') : target;
};

const canonicalOwners = new Map();
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

for (const file of htmlFiles) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    check(/^<!doctype html>/i.test(html.trimStart()), `${relative}: нет doctype`);
    check(/<html\b[^>]*\blang=["']ru["']/i.test(html), `${relative}: нет lang="ru"`);
    check(count(html, /<title>[\s\S]*?<\/title>/gi) === 1, `${relative}: нужен один title`);
    check(count(html, /<meta\s+name=["']description["']/gi) === 1, `${relative}: нужен один description`);
    check(count(html, /<link\s+rel=["']canonical["']/gi) === 1, `${relative}: нужен один canonical`);
    check(count(html, /<h1\b/gi) === 1, `${relative}: нужен один h1`);
    check(/<meta\s+name=["']viewport["']/i.test(html), `${relative}: нет viewport`);
    check(/<meta\s+property=["']og:title["']/i.test(html) && /<meta\s+property=["']og:description["']/i.test(html) && /<meta\s+property=["']og:image["']/i.test(html), `${relative}: неполный Open Graph`);
    check(/<meta\s+name=["']twitter:card["']/i.test(html) && /<meta\s+name=["']twitter:image["']/i.test(html), `${relative}: неполные Twitter Cards`);

    const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || '';
    check(description.length >= 45 && description.length <= 190, `${relative}: длина description ${description.length}`);
    const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    if (canonical) {
        check(!canonicalOwners.has(canonical), `${relative}: canonical уже используется в ${canonicalOwners.get(canonical)}`);
        canonicalOwners.set(canonical, relative);
    }

    const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map(match => match[1]);
    check(new Set(ids).size === ids.length, `${relative}: повторяющиеся id`);
    for (const match of html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try { JSON.parse(match[1]); } catch (error) { errors.push(`${relative}: некорректный JSON-LD — ${error.message}`); }
    }
    check(count(html, /<script\s+type=["']application\/ld\+json["']/gi) > 0, `${relative}: нет JSON-LD`);

    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
        const tag = match[0];
        check(attr(tag, 'alt') !== undefined, `${relative}: у изображения нет alt`);
        if (attr(tag, 'src')) check(/^\d+$/.test(attr(tag, 'width') || '') && /^\d+$/.test(attr(tag, 'height') || ''), `${relative}: у изображения нет width/height`);
    }
    for (const match of html.matchAll(/<(?:img|script|link|source|a)\b[^>]*>/gi)) {
        const tag = match[0];
        for (const name of ['src', 'href', 'data-full-src']) {
            const value = attr(tag, name);
            const target = localTarget(file, value);
            if (!target) continue;
            check(fs.existsSync(target), `${relative}: отсутствует ${value}`);
        }
    }
    for (const match of html.matchAll(/<meta\s+(?:property=["']og:image["']|name=["']twitter:image["'])\s+content=["']([^"']+)["']/gi)) {
        const target = localTarget(file, match[1]);
        if (target) check(fs.existsSync(target), `${relative}: отсутствует социальное изображение ${match[1]}`);
    }
}

// Runtime article links and thumbnails must also resolve before deployment.
const articleScript = fs.readFileSync(path.join(root, 'js/article.js'), 'utf8');
const catalog = JSON.parse(articleScript.match(/const articleCatalog = (\[[\s\S]*?\]);/)[1]);
for (const item of catalog) {
    check(fs.existsSync(path.join(root, 'img/blog', item.image)), `article catalog: missing ${item.image}`);
    const articleHtml = fs.readFileSync(path.join(root, 'blog', item.slug, 'index.html'), 'utf8');
    const articleScriptPosition = articleHtml.indexOf('src="../../js/article.js"');
    const commonScriptPosition = articleHtml.indexOf('src="../../js/site.js"');
    check(articleScriptPosition > 0 && commonScriptPosition > articleScriptPosition, `${item.slug}: article components must initialize before shared animations`);
}

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
check(new Set(sitemapUrls).size === sitemapUrls.length, 'sitemap.xml: повторяющиеся URL');
check(sitemapUrls.length === canonicalOwners.size, `sitemap.xml: ${sitemapUrls.length} URL, canonical: ${canonicalOwners.size}`);
for (const canonical of canonicalOwners.keys()) check(sitemapUrls.includes(canonical), `sitemap.xml: нет ${canonical}`);
check((sitemap.match(/<lastmod>/g) || []).length === sitemapUrls.length, 'sitemap.xml: lastmod указан не для всех URL');
assert.deepEqual(errors, [], errors.join('\n'));
console.log(`PASS: ${htmlFiles.length} страниц, ${canonicalOwners.size} canonical URL, ссылки, изображения, метаданные, JSON-LD и sitemap.`);
