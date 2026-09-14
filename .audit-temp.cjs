const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
});
const files = walk(root);
const images = files.filter(file => /\.(?:png|jpe?g|webp|svg)$/i.test(file));
const used = new Set();
const add = (base, url) => {
    const clean = url.split(/[?#]/)[0];
    if (!clean || /^(?:https?:|mailto:|tel:|#|data:)/i.test(clean)) return;
    const target = path.resolve(base, clean);
    if (fs.existsSync(target)) used.add(path.normalize(target));
};
for (const file of files.filter(file => /\.html$/i.test(file))) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) add(path.dirname(file), match[1]);
    for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
        for (const candidate of match[1].split(',')) add(path.dirname(file), candidate.trim().split(/\s+/)[0]);
    }
}
for (const file of files.filter(file => /\.css$/i.test(file))) {
    const css = fs.readFileSync(file, 'utf8');
    for (const match of css.matchAll(/url\(["']?([^)'"\s]+)/g)) add(path.dirname(file), match[1]);
}
const articles = JSON.parse(fs.readFileSync(path.join(root, 'data/articles.json'), 'utf8'));
for (const article of articles) {
    used.add(path.normalize(path.join(root, article.image)));
    for (const directory of ['previews', 'thumbnails']) {
        const derivative = path.join(root, 'img/blog', directory, path.basename(article.image) + '.webp');
        if (fs.existsSync(derivative)) used.add(path.normalize(derivative));
    }
}
for (const image of images.filter(file => !used.has(path.normalize(file)))) {
    console.log(path.relative(root, image));
}
