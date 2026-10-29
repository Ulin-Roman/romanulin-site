const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
const articles = JSON.parse(fs.readFileSync(path.join(root, 'data/articles.json'), 'utf8'));
const argumentsList = process.argv.slice(2);
const force = argumentsList.includes('--force');
const imageArguments = argumentsList.filter(argument => argument.startsWith('--image='));
if (argumentsList.some(argument => argument !== '--force' && !argument.startsWith('--image=')) || imageArguments.length > 1) {
    throw new Error('Usage: node scripts/optimize-images.cjs [--force] [--image=img/blog/file.jpg]');
}
const allImages = [...new Set(articles.map(article => article.image))];
const selectedImage = imageArguments[0]?.slice('--image='.length).replace(/\\/g, '/');
if (imageArguments.length && !allImages.includes(selectedImage)) throw new Error('--image must name an image from data/articles.json');
const images = selectedImage ? [selectedImage] : allImages;

(async () => {
    const generated = { thumbnails: 0, cards: 0, previews: 0 };
    let before = 0, after = 0;
    for (const image of images) {
        const source = path.resolve(root, image);
        if (!source.startsWith(root + path.sep)) throw new Error('Source image must stay inside the project: ' + image);
        const bytes = fs.statSync(source).size;
        const filename = path.basename(image) + '.webp';
        const create = async (directory, width, settings) => {
            const target = path.join(root, 'img/blog', directory, filename);
            // Git checkouts can change timestamps. Only explicit --force replaces derivatives.
            if (fs.existsSync(target) && !force) return;
            fs.mkdirSync(path.dirname(target), { recursive: true });
            const info = await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp(settings).toFile(target);
            generated[directory]++;
            if (directory === 'previews') { before += bytes; after += info.size; }
        };
        await create('thumbnails', 240, { quality: 88, alphaQuality: 100, effort: 6 });
        await create('cards', 640, { quality: 88, alphaQuality: 100, effort: 6 });
        const previewExists = fs.existsSync(path.join(root, 'img/blog/previews', filename));
        // Keep the existing 1200px/q82 preview profile and 200KB creation threshold.
        // A force refresh also updates a pre-existing preview of a smaller source.
        if (bytes >= 200000 || previewExists) await create('previews', 1200, { quality: 82, effort: 6 });
    }
    console.log(JSON.stringify({ selectedImages: images.length, generated, originalBytes: before, previewBytes: after, savedPreviewBytes: before - after }));
})().catch(error => { console.error(error); process.exitCode = 1; });
