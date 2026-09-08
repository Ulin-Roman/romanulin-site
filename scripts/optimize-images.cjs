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
        if (bytes < 200000) continue;
        const target = path.join(root, 'img/blog/previews', path.basename(image) + '.webp');
        // Preserve framing; lossless encoding after resizing, originals remain available.
        const buffer = await sharp(source).rotate().resize({ width: 960, withoutEnlargement: true }).webp({ lossless: true }).toBuffer();
        if (buffer.length >= bytes) continue;
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, buffer);
        before += bytes; after += buffer.length; count++;
    }
    console.log(JSON.stringify({ count, originalBytes: before, previewBytes: after, savedBytes: before - after }));
})().catch(error => { console.error(error); process.exitCode = 1; });
