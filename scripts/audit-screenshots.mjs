/**
 * audit-screenshots.mjs — Playwright screenshot audit for ChordVault UI.
 *
 * Usage: node scripts/audit-screenshots.mjs [base_url]
 * Default: http://localhost:3100
 *
 * Assumes seed-data.mjs has been run (demo/demopass123 account exists with data).
 * Saves timestamped screenshots to /tmp/cv-screenshots/<timestamp>/
 * and symlinks /tmp/cv-screenshots/latest for convenience.
 */

import { chromium } from 'playwright';
import { mkdirSync, unlinkSync, symlinkSync } from 'fs';

const BASE = process.argv[2] || 'http://localhost:3100';
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const DIR = `/tmp/cv-screenshots/${ts}`;
mkdirSync(DIR, { recursive: true });
console.log(`📁 Output: ${DIR}\n`);

const browser = await chromium.launch();
let n = 1;
const shot = async (page, name) => {
  const path = `${DIR}/${String(n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${String(n).padStart(2, '0')} ${name}`);
  n++;
};

const wait = (page, ms = 1200) => page.waitForTimeout(ms);

// Click nav button by exact text
const navClick = async (page, text) => {
  await page.locator(`nav button:has-text("${text}")`).first().click();
  await wait(page);
};

// ── DESKTOP UNAUTHENTICATED ────────────────────────────────────────
console.log('=== Desktop — Unauthenticated ===');
const dCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const d = await dCtx.newPage();

// 1. Landing
await d.goto(BASE);
await wait(d, 1500);
await shot(d, 'landing');

// 2. Browse songs
await navClick(d, 'Songs');
await shot(d, 'browse-unauth');

// 3. Song view
const songCard = d.locator('.song-card').first();
if (await songCard.count()) {
  await songCard.click();
  await wait(d);
  await shot(d, 'song-view-unauth');
}

// 4. Public setlists (unauth nav shows "Setlists" → public-setlists)
await navClick(d, 'Setlists');
// SPA transition needs extra time — wait for setlist-card to confirm view switch
await d.waitForSelector('.setlist-card', { timeout: 5000 }).catch(() => {});
await wait(d, 800);
await shot(d, 'public-setlists');

// 5. Setlist play
const slCard = d.locator('.setlist-card').first();
if (await slCard.count()) {
  await slCard.click();
  await wait(d, 1500);
  await shot(d, 'setlist-play-unauth');
}

// 6. Sign in
await d.goto(BASE);
await wait(d, 500);
await navClick(d, 'Sign in');
await shot(d, 'sign-in');

// 7. About
await d.goto(BASE);
await wait(d, 500);
const learnMore = d.locator('a:has-text("Learn more"), button:has-text("Learn more")').first();
if (await learnMore.count()) {
  await learnMore.click();
  await wait(d);
  await shot(d, 'about');
}

// ── DESKTOP AUTHENTICATED ──────────────────────────────────────────
console.log('\n=== Desktop — Authenticated ===');
// Navigate to sign in page
await d.goto(BASE);
await wait(d, 500);
await navClick(d, 'Sign in');

// Fill and submit
await d.waitForSelector('#auth-user', { timeout: 5000 });
await d.fill('#auth-user', 'demo');
await d.fill('input[type="password"]', 'demopass123');
await d.click('#auth-submit');
await wait(d, 1500);
await shot(d, 'browse-auth');

// Song view (auth)
const songCardAuth = d.locator('.song-card').first();
if (await songCardAuth.count()) {
  await songCardAuth.click();
  await wait(d);
  await shot(d, 'song-view-auth');
}

// Search
await navClick(d, 'Songs');
const searchInput = d.locator('input[type="search"]');
if (await searchInput.count()) {
  await searchInput.fill('grace');
  await searchInput.press('Enter');
  await wait(d);
  await shot(d, 'search-results');
}

// My Setlists (auth nav shows "Setlists" → setlists)
await navClick(d, 'Setlists');
await shot(d, 'my-setlists');

// Setlist play (auth)
const slCardAuth = d.locator('.setlist-card').first();
if (await slCardAuth.count()) {
  await slCardAuth.click();
  await wait(d, 1500);
  await shot(d, 'setlist-play-auth');
}

// Back to my setlists, then Public Setlists link
await navClick(d, 'Setlists');
const pubLink = d.locator('button:has-text("Public Setlists"), a:has-text("Public Setlists")').first();
if (await pubLink.count()) {
  await pubLink.click();
  await wait(d);
  await shot(d, 'public-setlists-auth');
}

// Menu dropdown
const menuBtn = d.locator('#nav-menu-btn');
if (await menuBtn.count()) {
  await menuBtn.click();
  await d.waitForTimeout(500);
  await shot(d, 'menu-dropdown');

  // My Songs
  await d.locator('#nav-dropdown button:has-text("My Songs")').click();
  await wait(d);
  await shot(d, 'my-songs');

  // Settings
  await menuBtn.click();
  await d.waitForTimeout(300);
  await d.locator('#nav-dropdown button:has-text("Settings")').click();
  await wait(d);
  await shot(d, 'settings');

  // Admin
  await navClick(d, 'Admin');
  await shot(d, 'admin-panel');
}

// Light mode
const themeBtn = d.locator('nav button.nav-icon').first();
if (await themeBtn.count()) {
  await themeBtn.click();
  await d.waitForTimeout(500);
  await navClick(d, 'Songs');
  await shot(d, 'browse-light');

  const songLight = d.locator('.song-card').first();
  if (await songLight.count()) {
    await songLight.click();
    await wait(d);
    await shot(d, 'song-view-light');
  }

  // Toggle back
  const themeBtn2 = d.locator('nav button.nav-icon').first();
  if (await themeBtn2.count()) await themeBtn2.click();
  await d.waitForTimeout(300);
}

// ── MOBILE UNAUTHENTICATED ─────────────────────────────────────────
console.log('\n=== Mobile — Unauthenticated ===');
const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const m = await mCtx.newPage();

await m.goto(BASE);
await wait(m, 1500);
await shot(m, 'mobile-landing');

await navClick(m, 'Songs');
await shot(m, 'mobile-browse');

const mobileSong = m.locator('.song-card').first();
if (await mobileSong.count()) {
  await mobileSong.click();
  await wait(m);
  await shot(m, 'mobile-song-view');
}

await navClick(m, 'Setlists');
await m.waitForSelector('.setlist-card', { timeout: 5000 }).catch(() => {});
await wait(m, 800);
await shot(m, 'mobile-public-setlists');

const mobileSl = m.locator('.setlist-card').first();
if (await mobileSl.count()) {
  await mobileSl.click();
  await wait(m, 1500);
  await shot(m, 'mobile-setlist-play');
}

// Mobile sign-in + login
await m.goto(BASE);
await wait(m, 500);
await navClick(m, 'Sign in');
await shot(m, 'mobile-sign-in');

await m.waitForSelector('#auth-user', { timeout: 5000 });
await m.fill('#auth-user', 'demo');
await m.fill('input[type="password"]', 'demopass123');
await m.click('#auth-submit');
await wait(m, 1500);
await shot(m, 'mobile-browse-auth');

await navClick(m, 'Setlists');
await shot(m, 'mobile-setlists-auth');

// ── DONE ───────────────────────────────────────────────────────────
await browser.close();

try { unlinkSync('/tmp/cv-screenshots/latest'); } catch {}
symlinkSync(DIR, '/tmp/cv-screenshots/latest');

console.log(`\n✅ ${n - 1} screenshots captured`);
console.log(`📁 ${DIR}`);
console.log('🔗 /tmp/cv-screenshots/latest');
