const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'romanulin-assets-'));
const write = (name, value) => {
    const target = path.join(temp, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
};
const digest = value => crypto.createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
try {
    write('scripts/version-assets.cjs', fs.readFileSync(path.join(root, 'scripts/version-assets.cjs')));
    for (const name of ['css/winter.css', 'css/privacy.css', 'css/reklama.css', 'js/site.js', 'js/article.js', 'js/season.js', 'js/privacy.js', 'js/reklama.js', 'js/copy-platforms.js']) write(name, '/* ' + name + ' */\n');
    const html = '<!doctype html><html><head><link href="../../css/winter.css" rel="stylesheet"><link href="../../css/privacy.css" rel="stylesheet"><link href="../../css/reklama.css" rel="stylesheet"><link href="https://fonts.example/style.css" rel="stylesheet"></head><body>'
        + ['site', 'article', 'privacy', 'reklama', 'copy-platforms'].map(name => '<script src="../../js/' + name + '.js#keep"></script>').join('')
        + '<script src="https://external.example/file.js"></script></body></html>';
    write('blog/test/index.html', html);
    const run = (...args) => execFileSync(process.execPath, ['scripts/version-assets.cjs', ...args], { cwd: temp, encoding: 'utf8' });
    run();
    run('--check');
    let updated = fs.readFileSync(path.join(temp, 'blog/test/index.html'), 'utf8');
    for (const name of ['site', 'article', 'privacy', 'reklama', 'copy-platforms']) assert.ok(updated.includes('../../js/' + name + '.js?v=' + digest('/* js/' + name + '.js */\n') + '#keep'));
    for (const name of ['winter', 'privacy', 'reklama']) assert.ok(updated.includes('../../css/' + name + '.css?v=' + digest('/* css/' + name + '.css */\n')));
    assert.equal((updated.match(/season\.js/g) || []).length, 1);
    assert.ok(updated.indexOf('season.js') < updated.indexOf('winter.css'));
    assert.ok(updated.includes('https://external.example/file.js'));
    assert.ok(updated.includes('https://fonts.example/style.css'));
    const oldVersion = updated.match(/article\.js\?v=([a-f0-9]+)/)[1];
    write('js/article.js', '/* changed daily article counters */\r\n');
    assert.throws(() => run('--check'), /Stale common asset versions/);
    run();
    run('--check');
    updated = fs.readFileSync(path.join(temp, 'blog/test/index.html'), 'utf8');
    const nextVersion = updated.match(/article\.js\?v=([a-f0-9]+)/)[1];
    assert.notEqual(nextVersion, oldVersion, 'daily article updates must use a fresh browser-cache URL');
    assert.equal(nextVersion, digest('/* changed daily article counters */\n'));
    assert.equal((updated.match(/season\.js/g) || []).length, 1);
    console.log('PASS: all runtime CSS/JS versions, daily article cache refresh, relative/external URLs, fragments, CRLF and single calendar bootstrap.');
} finally {
    const resolvedTemp = path.resolve(temp);
    assert.equal(path.dirname(resolvedTemp), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolvedTemp).startsWith('romanulin-assets-'));
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
}
