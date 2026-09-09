// Generate delivery copies; keep the original photographs available for zooming.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
async function main() {
    const file = path.join(root, 'index.html');
    let html = fs.readFileSync(file, 'utf8');
    let before = 0, after = 0, count = 0;
    for (const source of new Set([...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(m => m[1]))) {
        if (!/\.(png|jpe?g)$/i.test(source) || source.startsWith('img/blog/')) continue;
        const input = path.join(root, source);
        const bytes = fs.statSync(input).size;
        if (bytes < 80000) continue;
        const isPng = source.endsWith('.png');
        let pipeline = sharp(input).rotate();
        // Preserve transparent portraits pixel for pixel; size photos for their cards.
        if (!isPng) pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true });
        const buffer = await pipeline.webp(isPng ? { lossless: true } : { quality: 88 }).toBuffer();
        if (buffer.length >= bytes) continue;
        const target = 'img/optimized/' + source.slice(4).replaceAll('/', '-') + '.webp';
        fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
        fs.writeFileSync(path.join(root, target), buffer);
        html = html.replace(/<img\b[^>]*>/g, tag => tag.replace(`src="${source}"`, `src="${target}"`));
        before += bytes; after += buffer.length; count++;
    }
    fs.writeFileSync(file, html);
    console.log(JSON.stringify({ count, before, after, saved: before - after }));
    const articles = JSON.parse(fs.readFileSync(path.join(root, 'data/articles.json'), 'utf8'));
    for (const article of articles) {
        const target = path.join(root, 'img/blog/thumbnails', path.basename(article.image) + '.webp');
        if (fs.existsSync(target)) continue;
        await sharp(path.join(root, article.image)).rotate().resize({ width: 168, height: 124, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(target);
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
