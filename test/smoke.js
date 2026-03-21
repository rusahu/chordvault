const { chromium } = require('playwright');

async function run() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3100';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  const missingResources = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const ignorable404 = text.includes('Failed to load resource') || text.includes('/locales/') || text.includes('favicon.ico');
    if (msg.type() === 'error' && !ignorable404) {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });
  page.on('response', (res) => {
    if (res.status() === 404) missingResources.push(res.url());
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#nav', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('#app', { state: 'attached', timeout: 10000 });

  const appText = await page.locator('#app').innerText();
  if (!appText || !appText.trim()) {
    throw new Error('Main app container rendered empty content.');
  }

  const signInButton = page.locator('#nav-links .nav-signin');
  await signInButton.waitFor({ state: 'visible', timeout: 10000 });
  await signInButton.click();
  await page.waitForSelector('#auth-submit', { state: 'visible', timeout: 10000 });

  const unexpected404 = missingResources.filter((url) => {
    if (url.endsWith('/favicon.ico')) return false;
    if (/\/locales\/[a-zA-Z-]+\.json$/.test(url)) return false;
    return true;
  });

  if (consoleErrors.length > 0 || unexpected404.length > 0) {
    throw new Error(`Console errors found:\n${consoleErrors.join('\n')}\nUnexpected 404 resources:\n${unexpected404.join('\n')}`);
  }

  await browser.close();
  console.log('Smoke test passed.');
}

run().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
