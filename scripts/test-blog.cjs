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
    for (const name of ['index.html', 'blog/index.html', 'js/site.js', 'data/articles.json', 'sitemap.xml', 'scripts/build-blog.cjs']) {
        write(name, fs.readFileSync(path.join(root, name)));
    }
    for (const a of articles) {
        const name = `blog/${a.slug}/index.html`;
        write(name, fs.readFileSync(path.join(root, name)));
        write(a.image, 'fixture');
        const preview = 'img/blog/previews/' + path.basename(a.image) + '.webp';
        if (fs.existsSync(path.join(root, preview))) write(preview, 'fixture');
    }
    const run = (...args) => execFileSync(process.execPath, ['scripts/build-blog.cjs', ...args], { cwd: temp, encoding: 'utf8' });
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
    assert.match(fs.readFileSync(path.join(temp, 'sitemap.xml'), 'utf8'), /https:\/\/romanulin.ru\/blog\/discovery-test\//);
    for (const name of ['index.html', 'blog/index.html']) {
        const html = fs.readFileSync(path.join(temp, name), 'utf8');
        assert.match(html.match(/<article class="blog-card">[\s\S]*?<\/article>/)[0], /discovery-test/);
        assert.equal((html.match(/<article class="blog-card">/g) || []).length, name === 'index.html' ? 3 : updated.length);
    }
    const js = fs.readFileSync(path.join(temp, 'js/site.js'), 'utf8');
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
    console.log('PASS: discovery, ordering, lists, sitemap additions/removals, idempotence, existing data and article HTML unchanged.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
