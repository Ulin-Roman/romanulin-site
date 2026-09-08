// Article data is shared by the home page, blog index and article sidebar.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const outputs = new Map();
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const attr = (html, name) => decode(html.match(new RegExp('\\b' + name + '="([^"]*)"'))?.[1] || '');
const requireMatch = (html, regex, label) => {
    const match = html.match(regex);
    if (!match) throw new Error(`Missing ${label}`);
    return match;
};
const home = read('index.html');
const index = read('blog/index.html');
const site = read('js/site.js');
const catalogPattern = /const articleCatalog = (\[[\s\S]*?\]);/;
const oldCatalog = JSON.parse(requireMatch(site, catalogPattern, 'articleCatalog')[1]);
const dataFile = 'data/articles.json';
let articles;
if (fs.existsSync(path.join(root, dataFile))) {
    articles = JSON.parse(read(dataFile));
} else if (process.argv.includes('--import')) {
    // One-time migration preserves existing editorial excerpts and image attributes.
    articles = [...index.matchAll(/<article class="blog-card">[\s\S]*?<\/article>/g)].map(([card]) => {
        const slug = attr(card.match(/<a\b[^>]*>/)[0], 'href').replace(/\/$/, '');
        const image = card.match(/<img\b[^>]*>/)[0];
        const time = card.match(/<time\b[^>]*>[\s\S]*?<\/time>/)[0];
        const category = card.match(/<span class="blog-card-category[^"]*">([^<]*)<\/span>/);
        return { slug, title: decode(card.match(/<h2><a[^>]*>([\s\S]*?)<\/a><\/h2>/)[1]),
            published: attr(time, 'datetime'), date: time.replace(/<[^>]*>/g, ''),
            description: decode(card.match(/<p>([\s\S]*?)<\/p>/)[1]),
            image: attr(image, 'src').replace(/^\.\.\//, ''), width: +attr(image, 'width'), height: +attr(image, 'height'), alt: attr(image, 'alt'),
            category: category[0].match(/blog-card-category--([\w-]+)/)[1], categoryLabel: decode(category[1]),
            views: oldCatalog.find(a => a.slug === slug)?.views || '0' };
    });
} else throw new Error('Missing data/articles.json; restore the catalog before building.');

// A new article page is enough: discover its metadata on the next build.
for (const entry of fs.readdirSync(path.join(root, 'blog'), { withFileTypes: true })) {
    if (!entry.isDirectory() || !fs.existsSync(path.join(root, 'blog', entry.name, 'index.html'))) continue;
    if (articles.some(a => a.slug === entry.name)) continue;
    const html = read(`blog/${entry.name}/index.html`);
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    const schema = schemas.find(s => s['@type'] === 'BlogPosting');
    if (!schema) throw new Error(`Missing BlogPosting metadata: ${entry.name}`);
    const imageTag = requireMatch(html, /<img\b[^>]*src="[^"]*"[^>]*>/, entry.name + ' image')[0];
    const imageUrl = typeof schema.image === 'string' ? schema.image : schema.image.url;
    const image = new URL(imageUrl, 'https://romanulin.ru').pathname.slice(1);
    const actualImage = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]).find(tag => attr(tag, 'src').endsWith(image)) || imageTag;
    const category = html.match(/<span class="blog-card-category blog-card-category--([\w-]+)">([^<]+)<\/span>/);
    const published = schema.datePublished.slice(0, 10);
    articles.push({ slug: entry.name, title: schema.headline, published,
        date: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(published)).replace(/\s*г\.$/, ''),
        description: schema.description, image, width: +attr(actualImage, 'width'), height: +attr(actualImage, 'height'), alt: attr(actualImage, 'alt'),
        category: category?.[1] || 'practice', categoryLabel: decode(category?.[2] || 'Практика'), views: '0' });
}
const seen = new Set();
for (const a of articles) {
    if (seen.has(a.slug) || !/^[a-z0-9-]+$/.test(a.slug)) throw new Error(`Duplicate/invalid slug: ${a.slug}`);
    seen.add(a.slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.published) || !Number.isFinite(Date.parse(a.published))) throw new Error(`Invalid date: ${a.slug}`);
    if (!fs.existsSync(path.join(root, 'blog', a.slug, 'index.html'))) throw new Error(`Missing page: ${a.slug}`);
    if (!fs.existsSync(path.join(root, a.image))) throw new Error(`Missing image: ${a.image}`);
}
articles.sort((a, b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug));
outputs.set(dataFile, JSON.stringify(articles, null, 2) + '\n');
const arrow = '<span class="blog-link-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
function card(a, isHome) {
    const href = `${isHome ? 'blog/' : ''}${a.slug}/`;
    const heading = isHome ? 'h3' : 'h2';
    return `<article class="blog-card"><a class="blog-card-image blog-card-image--document" href="${href}"><img src="${isHome ? '' : '../'}${escape(a.image)}" width="${a.width}" height="${a.height}" alt="${escape(a.alt)}" loading="lazy" decoding="async"></a><div class="blog-card-copy"><div class="blog-card-meta"><span class="blog-card-category blog-card-category--${a.category}">${escape(a.categoryLabel)}</span><time datetime="${a.published}">${escape(a.date)}</time></div><${heading}><a href="${href}">${escape(a.title)}</a></${heading}><p>${escape(a.description)}</p><a class="blog-card-link" href="${href}">Читать статью ${arrow}</a></div></article>`;
}
function replaceCards(html, className, items, isHome) {
    const pattern = new RegExp('(<div class="' + className + '">)\\s*(?:<article class="blog-card">[\\s\\S]*?<\\/article>\\s*)+');
    requireMatch(html, pattern, className);
    return html.replace(pattern, (_, open) => open + '\n' + items.map(a => card(a, isHome)).join('\n') + '\n');
}
outputs.set('index.html', replaceCards(home, 'blog-track', articles.slice(0, 7), true));
let newIndex = replaceCards(index, 'blog-index-grid', articles, false);
newIndex = newIndex.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (all, json) => {
    const schema = JSON.parse(json);
    if (schema['@type'] !== 'CollectionPage') return all;
    schema.mainEntity = { '@type': 'ItemList', itemListElement: articles.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: `https://romanulin.ru/blog/${a.slug}/`, name: a.title })) };
    return '<script type="application/ld+json">' + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script>';
});
outputs.set('blog/index.html', newIndex);
const related = articles.map(a => ({ slug: a.slug, title: escape(a.title), date: escape(a.date), image: path.posix.relative('img/blog', a.image), views: a.views }));
outputs.set('js/site.js', site.replace(catalogPattern, () => 'const articleCatalog = ' + JSON.stringify(related, null, 4).replace(/</g, '\\u003c') + ';'));
const stale = [...outputs].filter(([file, value]) => !fs.existsSync(path.join(root, file)) || read(file) !== value);
if (process.argv.includes('--check')) {
    if (stale.length) throw new Error('Run npm run build; outdated: ' + stale.map(([f]) => f).join(', '));
} else {
    for (const [file, value] of stale) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), value);
    }
}
console.log(`${articles.length} articles; first: ${articles[0].published} — ${articles[0].title}; ${stale.length} updated files`);
