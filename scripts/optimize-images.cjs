const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
const articles = JSON.parse(fs.readFileSync(path.join(root, 'data/articles.json'), 'utf8'));
(async () => {
    let before = 0, after = 0, count = 0;
    for (const image of new Set(articles.map(a => a.image))) {
        const source = path.join(root, image);
        const bytes = fs.statSync(source).size;
        const thumbnail = path.join(root, 'img/blog/thumbnails', path.basename(image) + '.webp');
        if (!fs.existsSync(thumbnail)) {
            fs.mkdirSync(path.dirname(thumbnail), { recursive: true });
            await sharp(source).rotate().resize({ width: 336, height: 248, fit: 'cover', withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(thumbnail);
        }
        if (bytes < 200000) continue;
        const target = path.join(root, 'img/blog/previews', path.basename(image) + '.webp');
        if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= fs.statSync(source).mtimeMs) continue;
        // 1200 px is enough for the article column and social previews; originals remain as sources.
        const buffer = await sharp(source).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toBuffer();
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, buffer);
        before += bytes; after += buffer.length; count++;
    }
    console.log(JSON.stringify({ count, originalBytes: before, previewBytes: after, savedBytes: before - after }));
})().catch(error => { console.error(error); process.exitCode = 1; });
