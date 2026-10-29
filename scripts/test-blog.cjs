const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const articles = JSON.parse(fs.readFileSync(path.join(root, 'data/articles.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'romanulin-blog-test-'));
const write = (name, value) => {
    const target = path.join(temp, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
};
try {
    for (const name of ['index.html', 'blog/index.html', 'js/article.js', 'data/articles.json', 'sitemap.xml', 'scripts/build-blog.cjs']) {
        write(name, fs.readFileSync(path.join(root, name)));
    }
    for (const a of articles) {
        const name = `blog/${a.slug}/index.html`;
        write(name, fs.readFileSync(path.join(root, name)));
        write(a.image, 'fixture');
        const preview = 'img/blog/previews/' + path.basename(a.image) + '.webp';
        if (fs.existsSync(path.join(root, preview))) write(preview, 'fixture');
        const thumbnail = 'img/blog/thumbnails/' + path.basename(a.image) + '.webp';
        if (fs.existsSync(path.join(root, thumbnail))) write(thumbnail, fs.readFileSync(path.join(root, thumbnail)));
        const card = 'img/blog/cards/' + path.basename(a.image) + '.webp';
        if (fs.existsSync(path.join(root, card))) write(card, fs.readFileSync(path.join(root, card)));
    }
    const run = (...args) => execFileSync(process.execPath, ['scripts/build-blog.cjs', ...args], { cwd: temp, encoding: 'utf8', stdio: 'pipe' });
    run('--check');
    // Line endings alone must not make a generated catalog stale or rewrite it.
    const catalogPath = path.join(temp, 'data/articles.json');
    const originalCatalog = fs.readFileSync(catalogPath);
    const lfCatalog = originalCatalog.toString('utf8').replace(/\r\n/g, '\n');
    for (const lineEnding of ['\n', '\r\n']) {
        const fixture = Buffer.from(lfCatalog.replace(/\n/g, lineEnding));
        write('data/articles.json', fixture);
        run('--check');
        assert.deepEqual(fs.readFileSync(catalogPath), fixture, '--check must not rewrite line endings');
        run();
        assert.deepEqual(fs.readFileSync(catalogPath), fixture, 'build must not rewrite an EOL-only difference');
    }
    write('data/articles.json', originalCatalog);
    // Normalizing EOL must still reject an actual stale generated URL.
    const sitemapBefore = fs.readFileSync(path.join(temp, 'sitemap.xml'));
    write('sitemap.xml', sitemapBefore.toString('utf8').replace('<loc>https://romanulin.ru/</loc>', '<loc>https://example.invalid/</loc>'));
    assert.throws(() => run('--check'), /outdated: sitemap\.xml/);
    write('sitemap.xml', sitemapBefore);
    run('--check');
    // Add only a page, with no edits to any list or catalog.
    const first = articles[0];
    const schema = { '@type': 'BlogPosting', headline: 'Discovery test', description: 'Automatic discovery', datePublished: '2099-01-01', image: `https://romanulin.ru/${first.image}` };
    write('blog/discovery-test/index.html', `<script type="application/ld+json">${JSON.stringify(schema)}</script><img src="../../${first.image}" width="${first.width}" height="${first.height}">`);
    run();
    run('--check');
    const updated = JSON.parse(fs.readFileSync(path.join(temp, 'data/articles.json'), 'utf8'));
    assert.equal(updated.length, articles.length + 1);
    assert.equal(updated[0].slug, 'discovery-test');
    const sitemap = fs.readFileSync(path.join(temp, 'sitemap.xml'), 'utf8');
    assert.match(sitemap, /https:\/\/romanulin.ru\/blog\/discovery-test\//);
    assert.match(sitemap, /<lastmod>2099-01-01<\/lastmod>/);
    assert.match(sitemap, /<image:image><image:loc>/);
    for (const name of ['index.html', 'blog/index.html']) {
        const html = fs.readFileSync(path.join(temp, name), 'utf8');
        assert.match(html.match(/<article class="blog-card">[\s\S]*?<\/article>/)[0], /discovery-test/);
        assert.equal((html.match(/<article class="blog-card">/g) || []).length, name === 'index.html' ? 3 : updated.length);
    }
    const js = fs.readFileSync(path.join(temp, 'js/article.js'), 'utf8');
    const catalog = JSON.parse(js.match(/const articleCatalog = (\[[\s\S]*?\]);/)[1]);
    assert.equal(catalog[0].slug, 'discovery-test');
    assert.deepEqual(updated.slice(1), articles);
    for (const a of articles) {
        const name = `blog/${a.slug}/index.html`;
        assert.deepEqual(fs.readFileSync(path.join(temp, name)), fs.readFileSync(path.join(root, name)));
    }
    fs.unlinkSync(path.join(temp, 'blog/discovery-test/index.html'));
    write('data/articles.json', JSON.stringify(articles));
    run();
    run('--check');
    assert.doesNotMatch(fs.readFileSync(path.join(temp, 'sitemap.xml'), 'utf8'), /discovery-test/);
    console.log('PASS: LF/CRLF checks without rewrites, stale content rejection, discovery, ordering, lists, sitemap additions/removals, idempotence, existing data and article HTML unchanged.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
