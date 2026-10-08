const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../public');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = readFileSync(path.join(root, 'sw.js'), 'utf8');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.start_url, '/');
assert.equal(manifest.display, 'standalone');
for (const icon of manifest.icons) assert.ok(existsSync(path.join(root, icon.src)));
assert.ok(worker.includes('locales/en.json'), 'English locale must be precached');
assert.ok(!worker.includes('stale-offline-test.js'), 'Old emitted assets must not be precached');
const styles = [...html.matchAll(/href="(\/assets\/[^" ]+\.css)"/g)].map(m => m[1]);
assert.ok(styles.length);
let fonts = 0;
for (const style of styles) {
  const css = readFileSync(path.join(root, style), 'utf8');
  for (const match of css.matchAll(/url\(["']?(\/assets\/[^)"']+\.(?:woff2?|ttf))["']?\)/g)) {
    assert.ok(worker.includes(path.basename(match[1])), `Missing font: ${match[1]}`);
    fonts++;
  }
}
assert.ok(fonts > 10, 'CJK font chunks must be included, not only previously used glyphs');
const pdfFonts = [...worker.matchAll(/url:"([^"]+\.ttf)"/g)].map(match => match[1]);
assert.equal(pdfFonts.length, 2, 'Both regular and semibold PDF fonts must be precached');
for (const font of pdfFonts) assert.ok(existsSync(path.join(root, font)));
console.log(`Offline build assets verified, including ${fonts} font references.`);
