/* global AbortSignal */
const { execFileSync } = require('node:child_process');
const { appendFileSync } = require('node:fs');
const { setTimeout: sleep } = require('node:timers/promises');
const assert = require('node:assert/strict');

const image = process.env.DOCKER_TEST_IMAGE || 'chordvault:ci';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 20_000 }).trim();

async function check(demo) {
  const name = `chordvault-ci-${process.pid}-${demo ? 'demo' : 'normal'}`;
  const volume = `${name}-data`;
  const started = Date.now();
  try {
    docker('run', '-d', '--name', name, '-p', '127.0.0.1::3100', '-v', `${volume}:/app/data`,
      '-e', 'JWT_SECRET=disposable-ci-secret', '-e', 'NODE_ENV=production', '-e', `DEMO_MODE=${demo}`, image);
    const port = docker('port', name, '3100/tcp').split(':').at(-1);
    const base = `http://127.0.0.1:${port}`;
    let config;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      assert.equal(docker('inspect', '-f', '{{.State.Running}}', name), 'true', 'container exited before ready');
      try {
        const response = await fetch(`${base}/api/auth/config`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) { config = await response.json(); break; }
      } catch { /* Connection can fail while Node starts. */ }
      await sleep(1000);
    }
    assert.ok(config, 'container did not become ready in 60 seconds');
    assert.equal(config.demoMode, demo);
    const page = await fetch(base, { signal: AbortSignal.timeout(5000) });
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const script = (await page.text()).match(/<script\b[^>]*\bsrc="([^"]+)"/);
    assert.ok(script, 'built frontend script is missing');
    const asset = await fetch(new URL(script[1], base), { signal: AbortSignal.timeout(5000) });
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    for (const [url, mime] of [['/manifest.webmanifest', /json/], ['/sw.js', /javascript/], ['/locales/en.json', /json/], ['/icon-192.png', /image\/png/]]) {
      const response = await fetch(`${base}${url}`, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200, `missing offline asset ${url}`);
      assert.match(response.headers.get('content-type'), mime);
    }
    const worker = await (await fetch(`${base}/sw.js`)).text();
    const font = worker.match(/url:"([^"]+\.ttf)"/);
    assert.ok(font, 'PDF font missing from offline manifest');
    assert.equal((await fetch(new URL(font[1], base), { signal: AbortSignal.timeout(5000) })).status, 200);
    if (demo) {
      const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'demo', password: 'demopass123' }), signal: AbortSignal.timeout(5000),
      });
      assert.equal(login.status, 200);
      assert.ok((await login.json()).token);
      const songs = await fetch(`${base}/api/songs/public`, { signal: AbortSignal.timeout(5000) });
      assert.equal(songs.status, 200);
      assert.ok((await songs.json()).length > 0, 'demo seed has no public songs');
    }
    const result = `${demo ? 'Demo' : 'Normal'} image startup/API/assets: passed in ${((Date.now() - started) / 1000).toFixed(1)}s`;
    console.log(result);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${result}\n\n`);
  } catch (error) {
    try { console.error(docker('logs', name)); } catch { /* Container may not have started. */ }
    throw error;
  } finally {
    try { docker('rm', '-f', name); } catch { /* Already removed or never created. */ }
    try { docker('volume', 'rm', volume); } catch { /* Already removed or never created. */ }
  }
}

(async () => {
  await check(false);
  await check(true);
})().catch(error => { console.error(error); process.exitCode = 1; });
