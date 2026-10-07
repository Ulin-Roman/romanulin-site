const assert = require('node:assert/strict');
const { sourcePost, parseViews, fetchViews, refresh } = require('./update-telegram-views.cjs');
const schema = post => `<script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', isBasedOn: `https://t.me/${post}` })}</script>`;
const widget = (post, count) => `<div data-post="${post}"><span class="tgme_widget_message_views">${count}</span></div>`;

async function test() {
    assert.equal(sourcePost(schema('direct_ulin/293')), 'direct_ulin/293');
    assert.throws(() => sourcePost(schema('other_channel/1')));
    for (const count of ['0', '214', '1.37K', '2M']) assert.equal(parseViews(widget('direct_ulin/293', count), 'direct_ulin/293'), count);
    assert.throws(() => parseViews(widget('direct_ulin/290', '500'), 'direct_ulin/293'));
    assert.throws(() => parseViews(widget('direct_ulin/293', 'unknown'), 'direct_ulin/293'));
    assert.throws(() => parseViews('Post not found', 'direct_ulin/293'));
    assert.throws(() => parseViews(widget('direct_ulin/293', '10') + widget('direct_ulin/290', '20'), 'direct_ulin/293'));
    assert.equal(await fetchViews('direct_ulin/293', async url => {
        assert.equal(url, 'https://t.me/direct_ulin/293?embed=1&mode=tme');
        return { ok: true, text: async () => widget('direct_ulin/293', '214') };
    }), '214');
    const articles = [{ slug: 'good', views: '0' }, { slug: 'unavailable', views: '1.37K' }];
    assert.deepEqual(await refresh(articles, () => schema('direct_ulin/293'), async () => {
        if (articles[0].views === '0') return '214';
        throw new Error('Unavailable');
    }, () => {}), { successful: 1, changed: 1, failed: 1 });
    assert.equal(articles[0].views, '214');
    assert.equal(articles[1].views, '1.37K');
    await assert.rejects(refresh(articles, () => '', async () => '0', () => {}));
    assert.equal(articles[1].views, '1.37K');
    console.log('Telegram counter tests passed');
}
test().catch(error => { console.error(error); process.exitCode = 1; });
