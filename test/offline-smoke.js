/* global window, document, navigator, Event, PerformanceObserver, localStorage, indexedDB, caches */
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { createServer } = require('node:net');
const { createServer: createHttpsServer } = require('node:https');
const { request: proxyRequest } = require('node:http');
const { setTimeout: sleep } = require('node:timers/promises');
const { chromium, webkit } = require('playwright');
const { createHash } = require('node:crypto');
const jwt = require('jsonwebtoken');

async function run() {
  const directory = mkdtempSync(join(tmpdir(), 'chordvault-offline-'));
  process.env.DB_PATH = join(directory, 'library.db');
  process.env.JWT_SECRET = 'offline-browser-fixture-only';
  const { db } = require('../lib/db');
  const account = Number(db.prepare('INSERT INTO users (username,password_hash) VALUES (?,?)').run('offline-musician', 'unused').lastInsertRowid);
  const other = Number(db.prepare('INSERT INTO users (username,password_hash) VALUES (?,?)').run('other-musician', 'unused').lastInsertRowid);
  const insert = db.prepare('INSERT INTO songs (user_id,title,content,visibility,language,parent_id) VALUES (?,?,?,?,?,?)');
  db.transaction(() => {
    for (let i = 1; i <= 125; i++) insert.run(account, `Practice ${i}`, `{title: Practice ${i}}\n{key: C}\n{start_of_verse}\n[C]Sing a [F]new song\n{end_of_verse}`, i === 124 ? 'private' : 'public', 'en', null);
    insert.run(account, '喜樂 測試', '{title: 喜樂 測試}\n{key: D}\n[D]喜樂 [G]靜謐 龍龜 麟鳳', 'public', 'zh', null);
    insert.run(account, 'Practice 1 alternate', '{title: Practice 1 alternate}\n{key: G}\n[G]Another version', 'public', 'en', 1);
    insert.run(other, 'Denied private song', '[C]Secret', 'private', 'en', null);
    const sl = db.prepare('INSERT INTO setlists (user_id,name) VALUES (?,?)');
    const entry = db.prepare('INSERT INTO setlist_songs (setlist_id,song_id,position,target_key,content_override) VALUES (?,?,?,?,?)');
    for (let i = 1; i <= 25; i++) {
      sl.run(account, `Offline set ${i}`);
      entry.run(i, 125, 0, 'D', '[D]Setlist override');
      entry.run(i, 126, 1, null, null);
      entry.run(i, 128, 2, null, 'must be masked');
    }
  })();
  const user = { id: account, username: 'offline-musician', role: 'user', token: jwt.sign({ id: account }, process.env.JWT_SECRET) };
  const portProbe = createServer();
  await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const server = spawn(process.execPath, ['server.js'], { cwd: join(__dirname, '..'), env: { ...process.env, PORT: String(port), NODE_ENV: process.env.OFFLINE_REGRESSIONS === '1' ? 'test' : 'production' }, stdio: ['ignore','pipe','pipe'] });
  let serverLog = '';
  server.stdout.on('data', data => { serverLog += data; });
  server.stderr.on('data', data => { serverLog += data; });
  let base = `http://127.0.0.1:${port}`;
  let tlsServer;
  const htmlPath = join(__dirname, '../public/index.html');
  const workerPath = join(__dirname, '../public/sw.js');
  const originalHtml = readFileSync(htmlPath, 'utf8');
  const originalWorker = readFileSync(workerPath, 'utf8');
  let browser;
  let page;
  try {
    for (let attempt = 0; attempt < 80; attempt++) {
      if (server.exitCode !== null) throw new Error(serverLog);
      try { if ((await fetch(`${base}/api/auth/config`)).ok) break; } catch { /* starting */ }
      await sleep(250);
    }
    if (process.env.OFFLINE_BROWSER === 'webkit') {
      const key = join(directory, 'localhost.key');
      const cert = join(directory, 'localhost.crt');
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=localhost', '-keyout', key, '-out', cert, '-days', '1', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], { stdio: 'ignore' });
      tlsServer = createHttpsServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
        const upstream = proxyRequest({ hostname: '127.0.0.1', port, method: request.method, path: request.url, headers: request.headers }, result => {
          response.writeHead(result.statusCode, result.headers);
          result.pipe(response);
        });
        upstream.on('error', () => { response.writeHead(502); response.end(); });
        request.pipe(upstream);
      });
      await new Promise(resolve => tlsServer.listen(0, '127.0.0.1', resolve));
      base = `https://127.0.0.1:${tlsServer.address().port}`;
    }
    if (process.env.OFFLINE_REGRESSIONS === '1') {
      const originalSong = db.prepare('SELECT content FROM songs WHERE id=1').get().content;
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(require('bcryptjs').hashSync('offline-test-password', 4), account);
      db.prepare('UPDATE songs SET content=? WHERE id=1').run(`{title: Practice 1}\n{key: C}\n[C]${'A long synthetic practice line '.repeat(12)}`);
      db.prepare('UPDATE songs SET title=? WHERE id=127').run('A long bilingual practice title 喜樂 測試 慢慢唱出這首詩歌');
      db.prepare('INSERT INTO setlists (user_id,name,visibility) VALUES (?,?,?)').run(account, 'Layout fixture', 'public');
      for (const [position, id] of [1,126,127].entries()) db.prepare('INSERT INTO setlist_songs (setlist_id,song_id,position) VALUES (26,?,?)').run(id, position);
      try {
        const smoke = execFileSync(process.execPath, ['test/smoke.js'], { env: { ...process.env, BASE_URL: base }, timeout: 90_000, encoding: 'utf8' });
        console.log(smoke.trim());
        const layout = execFileSync(process.execPath, ['scripts/check-layout.mjs'], { env: { ...process.env, CV_CHECK_BASE: base, CV_CHECK_SETLIST_ID: '26', CV_CHECK_CHANNEL: process.env.PLAYWRIGHT_CHANNEL || '', CV_CHECK_USER: 'offline-musician', CV_CHECK_PASSWORD: 'offline-test-password', CV_CHECK_SONG_ID: '1' }, timeout: 180_000, encoding: 'utf8' });
        console.log(layout.trim());
      } finally {
        db.prepare('DELETE FROM setlists WHERE id=26').run();
        db.prepare('UPDATE songs SET content=? WHERE id=1').run(originalSong);
        db.prepare('UPDATE songs SET title=? WHERE id=127').run('Practice 1 alternate');
      }
    }
    browser = await (process.env.OFFLINE_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true, ...(process.env.OFFLINE_BROWSER !== 'webkit' && process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, acceptDownloads: true, ignoreHTTPSErrors: true });
    const tlsPort = tlsServer?.address().port;
    const setDisconnected = async offline => {
      if (!tlsServer) return context.setOffline(offline);
      // Playwright #42775: WebKit offline emulation blocks cached SW responses.
      if (offline && tlsServer.listening) {
        tlsServer.closeAllConnections();
        await new Promise(resolve => tlsServer.close(resolve));
      } else if (!offline && !tlsServer.listening) {
        await new Promise(resolve => tlsServer.listen(tlsPort, '127.0.0.1', resolve));
      }
    };
    page = await context.newPage();
    const errors = [];
    context.on('page', p => {
      p.on('pageerror', e => { errors.push(e.message); console.error('Page error:', p.url(), e.message); });
    });
    page.on('pageerror', e => { errors.push(e.message); console.error('Page error:', e.message); });
    await page.goto(base);
    await page.evaluate(user => {
      localStorage.setItem('cv_user', JSON.stringify(user));
      localStorage.setItem('cv_local_setlists', JSON.stringify([{ id: 'local_offline', name: 'Local practice', entries: [{ song_id: 125, title: 'Practice 125' }, { song_id: 999, title: 'Missing fixture' }, { song_id: 126, title: '喜樂 測試' }] }]));
    }, user);
    await page.reload();
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
    await page.getByRole('switch', { name: 'Keep my library offline' }).click();
    await page.getByText(/127 songs.*25 setlists.*Last downloaded/).waitFor({timeout: 60_000});
    assert.equal(await page.evaluate(async () => (await caches.keys()).length > 0), true);
    mkdirSync('test-results/offline', { recursive: true });
    await page.screenshot({ path: 'test-results/offline/settings.png', fullPage: true });
    await page.close();
    await setDisconnected(true);
    page = await context.newPage();
    await page.goto(`${base}/#song/125`);
    await page.getByRole('heading', { name: 'Practice 125', exact: true }).waitFor();
    assert.equal(await page.evaluate(async () => {
      const response = await fetch('/locales/en.json');
      return response.ok && (await response.json())['offline.enable'] === 'Keep my library offline';
    }), true);
    assert.equal(await page.getByRole('button', { name: /Edit/ }).isDisabled(), true);
    await page.goto(`${base}/#song/127`);
    await page.getByRole('heading', { name: 'Practice 1 alternate' }).waitFor();
    await page.goto(`${base}/#setlist/25/play`);
    await page.locator('.chord-sheet-wrap').filter({ hasText: 'Setlist override' }).waitFor();
    await page.getByRole('button', { name: 'Next Song', exact: true }).click();
    await page.getByRole('heading', { name: '喜樂 測試', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('16px "Noto Sans TC Variable"', '靜謐龍龜麟鳳')), true);
    await page.getByRole('button', { name: 'More display options' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export PDF' }).click();
    assert.equal(await (await download).failure(), null);
    await page.getByRole('button', { name: 'Fit', exact: true }).click();
    await page.screenshot({ path: 'test-results/offline/tablet-playback.png' });
    const title = await page.locator('h1').textContent();
    await setDisconnected(false);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.equal(await page.locator('h1').textContent(), title);
    assert.ok(page.url().endsWith('/play/1'));
    await setDisconnected(true);
    await page.goto(`${base}/#setlist/local_offline/play/1`);
    await page.getByRole('heading', { name: 'Missing fixture (not downloaded)' }).waitFor();
    await page.getByRole('button', { name: 'Next Song', exact: true }).click();
    await page.getByRole('heading', { name: '喜樂 測試', exact: true }).waitFor();
    await page.goto(base);
    await page.getByRole('searchbox', { name: /Search/ }).fill('xi le');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.locator('.song-card-title').filter({ hasText: '喜樂 測試' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'New Song', exact: true }).isDisabled(), true);
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 1024 });
      for (const scheme of ['light', 'dark']) {
        await page.evaluate(scheme => {
          localStorage.setItem('cv_theme', scheme);
          window.history.replaceState(null, '', '/#setlist/25/play/1');
        }, scheme);
        const locale = page.waitForResponse(response => response.url() === `${base}/locales/en.json` && response.ok());
        await page.reload();
        assert.equal((await (await locale).json())['offline.enable'], 'Keep my library offline');
        await page.getByRole('heading', { name: '喜樂 測試', exact: true }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        assert.equal(await page.locator('html').getAttribute('data-mantine-color-scheme'), scheme);
        await page.screenshot({ path: `test-results/offline/${process.env.OFFLINE_BROWSER || 'chromium'}-${scheme}-${width}.png` });
      }
    }
    await page.goto(base);
    if (process.env.OFFLINE_BROWSER !== 'webkit') {
      await setDisconnected(false);
      await page.goto(`${base}/#setlist/25/play`);
      await page.locator('h1').waitFor();
      const second = await context.newPage();
      await second.goto(base);
      const htmlB = originalHtml.replace('</head>', '<meta name="offline-build" content="B"></head>');
      const revision = createHash('md5').update(htmlB).digest('hex');
      writeFileSync(htmlPath, htmlB);
      writeFileSync(workerPath, originalWorker.replace(/url:"index.html",revision:"[^"]+"/, `url:"index.html",revision:"${revision}"`));
      await second.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await second.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
      await setDisconnected(true);
      await page.getByRole('button', { name: 'More display options' }).click();
      const oldDownload = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Export PDF' }).click();
      assert.equal(await (await oldDownload).failure(), null);
      await second.close();
      const reopened = await context.newPage();
      await reopened.goto(base);
      assert.equal(await reopened.locator('meta[name="offline-build"]').count(), 0);
      assert.equal(await reopened.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), true);
      await reopened.close();
      await page.close();
      page = await context.newPage();
      await page.goto(base);
      await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).waiting);
      await page.reload();
      assert.equal(await page.locator('meta[name="offline-build"]').getAttribute('content'), 'B');
      console.log('App update: B waited for both A tabs; A exported PDF offline; B activated after all A tabs closed.');
    }
    if (process.env.OFFLINE_SCALE === '1') {
      await setDisconnected(false);
      db.transaction(() => {
        for (let i = 128; i <= 10000; i++) insert.run(account, `Scale song ${i}`, `{title: Scale song ${i}}\n{key: C}\n${'[C]Synthetic practice line for a large library\n'.repeat(24)}`, 'public', 'en', null);
      })();
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.getByRole('button', { name: 'Account menu' }).click();
      await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
      const snapshotResponse = page.waitForResponse(response => response.url().endsWith('/api/offline-library') && response.status() === 200);
      await page.evaluate(() => {
        window.offlineLongTasks = [];
        if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
          window.offlineObserver = new PerformanceObserver(list => window.offlineLongTasks.push(...list.getEntries().map(e => e.duration)));
          window.offlineObserver.observe({ type: 'longtask' });
        }
      });
      const start = Date.now();
      await page.getByRole('button', { name: 'Refresh now' }).click();
      const response = await snapshotResponse;
      const snapshotBytes = Number(await response.headerValue('content-length'));
      assert.ok(snapshotBytes > 0);
      await page.getByText(/10000 songs.*25 setlists.*Last downloaded/).waitFor({ timeout: 60_000 });
      const refreshMs = Date.now() - start;
      await setDisconnected(true);
      await page.getByRole('button', { name: 'Songs', exact: true }).click();
      await page.getByRole('searchbox', { name: /Search/ }).fill('Scale song 9999');
      const searchStart = Date.now();
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.locator('.song-card-title').filter({ hasText: 'Scale song 9999' }).waitFor();
      const searchMs = Date.now() - searchStart;
      const detailStart = Date.now();
      await page.locator('.song-card-title').filter({ hasText: 'Scale song 9999' }).click();
      await page.getByRole('heading', { name: 'Scale song 9999', exact: true }).waitFor();
      const longTasks = await page.evaluate(() => { window.offlineObserver?.disconnect(); return window.offlineLongTasks; });
      console.log(JSON.stringify({ scaleSongs: 10000, snapshotBytes, refreshMs, searchMs, detailMs: Date.now() - detailStart, longTasks, hardware: `${process.platform}/${process.arch} ${require('node:os').cpus()[0]?.model}` }));
    }
    const privateTab = await context.newPage();
    await privateTab.goto(`${base}/#song/124`);
    await privateTab.getByRole('heading', { name: 'Practice 124', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
    await privateTab.getByRole('heading', { name: 'Practice 124', exact: true }).waitFor({ state: 'hidden' });
    await privateTab.close();
    await page.waitForFunction(() => localStorage.getItem('cv_user') === null);
    await page.waitForFunction(() => new Promise(resolve => {
      const open = indexedDB.open('chordvault-offline');
      open.onsuccess = () => { const db = open.result; const request = db.transaction('songs').objectStore('songs').count(); request.onsuccess = () => { resolve(request.result === 0); db.close(); }; };
    }));
    assert.deepEqual(errors, []);
    console.log('Offline browser: cold starts, 127 songs, 25 setlists, versions, Chinese/pinyin, PDF, playback, placeholders, read-only UI and logout passed.');
    await context.close();
  } catch (error) {
    console.error('Browser at failure:', page?.url(), await page?.locator('body').innerText().catch(() => 'unavailable'));
    throw error;
  } finally {
    writeFileSync(htmlPath, originalHtml);
    writeFileSync(workerPath, originalWorker);
    await browser?.close();
    tlsServer?.closeAllConnections();
    if (tlsServer) await new Promise(resolve => tlsServer.close(resolve));
    server.kill('SIGTERM');
    await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
