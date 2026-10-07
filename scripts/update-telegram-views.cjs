const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function sourcePost(html) {
    for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        const schema = JSON.parse(match[1]);
        const entries = Array.isArray(schema) ? schema : schema['@graph'] || [schema];
        for (const entry of entries) {
            if (entry['@type'] !== 'BlogPosting') continue;
            const post = /^https:\/\/t\.me\/(direct_ulin\/\d+)\/?$/.exec(entry.isBasedOn || '');
            if (post) return post[1];
        }
    }
    throw new Error('No public Telegram source in BlogPosting');
}

function parseViews(html, post) {
    // Reject unavailable posts and unrelated widgets, including forwarded posts.
    const posts = [...html.matchAll(/\bdata-post=["']([^"']+)["']/g)].map(match => match[1]);
    const counts = [...html.matchAll(/<span\b[^>]*class=["']tgme_widget_message_views["'][^>]*>([^<]*)<\/span>/g)];
    if (posts.length !== 1 || posts[0] !== post || counts.length !== 1) {
        throw new Error('Telegram returned no unambiguous matching post');
    }
    const count = counts[0][1].replace(/&nbsp;|&#160;|&#xA0;/gi, ' ').trim();
    if (!/^\d+(?:[.,]\d+)?[KM]?$/.test(count)) throw new Error('Invalid Telegram views');
    return count;
}

async function fetchViews(post, fetcher = fetch) {
    if (!/^direct_ulin\/\d+$/.test(post)) throw new Error('Invalid post reference');
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetcher(`https://t.me/${post}?embed=1&mode=tme`, {
                signal: AbortSignal.timeout(20000)
            });
            if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
            return parseViews(await response.text(), post);
        } catch (error) {
            lastError = error;
            if (attempt < 2) await pause(1000 * (attempt + 1));
        }
    }
    throw lastError;
}

async function refresh(articles, readArticle, getViews, report = console.warn) {
    let successful = 0;
    let changed = 0;
    // Sequential requests with a small pause avoid bursts against Telegram.
    for (const article of articles) {
        try {
            const post = sourcePost(readArticle(article));
            const views = await getViews(post);
            successful++;
            if (article.views !== views) {
                article.views = views;
                changed++;
            }
        } catch (error) {
            report(`${article.slug}: keeping previous views (${error.message})`);
        }
    }
    if (!successful) throw new Error('No Telegram counters retrieved; existing data retained');
    return { successful, changed, failed: articles.length - successful };
}

async function main() {
    const file = path.join(root, 'data/articles.json');
    const articles = JSON.parse(fs.readFileSync(file, 'utf8'));
    const result = await refresh(articles,
        article => fs.readFileSync(path.join(root, 'blog', article.slug, 'index.html'), 'utf8'),
        async post => { const views = await fetchViews(post); await pause(250); return views; });
    if (result.changed) fs.writeFileSync(file, JSON.stringify(articles, null, 2) + '\n');
    console.log(`Telegram views: ${result.successful} retrieved, ${result.changed} changed, ${result.failed} retained after errors`);
}

module.exports = { sourcePost, parseViews, fetchViews, refresh };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
