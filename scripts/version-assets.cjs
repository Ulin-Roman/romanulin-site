// Version all public stylesheets and scripts; preserve page-relative URLs.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');
const assetNames = ['css', 'js'].flatMap(directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:css|js)$/i.test(entry.name))
    .map(entry => directory + '/' + entry.name)).sort();
const versions = new Map(assetNames.map(name => {
    // Git may check out CRLF on Windows and LF on the deployment runner.
    const content = fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
    return [path.resolve(root, name), createHash('sha256').update(content).digest('hex').slice(0, 12)];
}));

const walk = directory => fs.readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(file) : entry.isFile() && /\.html$/i.test(entry.name) ? [file] : [];
    });

function versionUrl(value, file) {
    // External, protocol-relative and non-HTTP schemes must never be rewritten.
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
    const pathname = value.split(/[?#]/, 1)[0];
    if (!pathname) return value;
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return value; }
    const target = pathname.startsWith('/')
        ? path.resolve(root, decoded.replace(/^\/+/, ''))
        : path.resolve(path.dirname(file), decoded);
    const version = versions.get(target);
    if (!version) return value;
    const fragment = value.includes('#') ? value.slice(value.indexOf('#')) : '';
    return `${pathname}?v=${version}${fragment}`;
}

const changed = [];
const files = walk(root);
for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    let source = original;
    if (!/<script\b[^>]*\bsrc=["'][^"']*\bseason\.js(?:[?#][^"']*)?["']/i.test(source)) {
        const stylesheet = source.match(/<link\b[^>]*\bhref=["'][^"']*\bwinter\.css(?:[?#][^"']*)?["'][^>]*>/i);
        if (!stylesheet) throw new Error('Missing shared stylesheet: ' + file);
        const calendarPath = path.relative(path.dirname(file), path.join(root, 'js/season.js')).replace(/\\/g, '/');
        source = source.replace(stylesheet[0], '<script src="' + calendarPath + '"></script>\n    ' + stylesheet[0]);
    }
    const updated = source.replace(/<(?:link|script)\b[^>]*>/gi, tag =>
        tag.replace(/(\s(?:href|src)\s*=\s*)(["'])([^"']*)\2/gi,
            (_, prefix, quote, value) => `${prefix}${quote}${versionUrl(value, file)}${quote}`));
    if (updated === original) continue;
    changed.push(path.relative(root, file).replace(/\\/g, '/'));
    if (!checkOnly) fs.writeFileSync(file, updated);
}

if (checkOnly && changed.length) {
    console.error(`Stale common asset versions in ${changed.length} HTML files. Run npm run build:\n${changed.join('\n')}`);
    process.exitCode = 1;
} else {
    console.log(`PASS: common asset versions ${checkOnly ? 'checked' : 'updated'} in ${files.length} HTML files; ${changed.length} changed.`);
}
