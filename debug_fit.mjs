import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.text().startsWith('[FitDebug]')) {
      console.log(msg.text());
    } else if (msg.type() === 'error') {
      console.error('ERROR:', msg.text());
    }
  });

  try {
    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/');

    // Check if we are on login page
    const loginForm = await page.$('form');
    if (loginForm) {
      console.log('Login form detected. Attempting login...');
      // Standard ChordVault dev credentials are often admin/admin or similar
      // But I should check if I can just go to a song URL directly if I know one.
      // Let's try to find if there's a "Guest" or "Public" link, or just try common creds.
      // Actually, let's see what's on the page.
      const text = await page.innerText('body');
      console.log('Page text snippet:', text.substring(0, 200));
      
      if (text.includes('Login')) {
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin');
        await page.click('button[type="submit"]');
        await page.waitForNavigation();
      }
    }

    // Wait for the song list to load
    console.log('Waiting for song list...');
    await page.waitForSelector('.song-item, a[href^="/song/"], .song-card', { timeout: 10000 });

    // Click the first song
    console.log('Clicking the first song...');
    const firstSong = await page.$('.song-item, a[href^="/song/"], .song-card');
    await firstSong.click();

    // Wait for the song view to load and the "Fit" button to appear
    console.log('Waiting for "Fit" button...');
    const fitButton = await page.waitForSelector('button:has-text("Fit"), .fit-button', { timeout: 10000 });

    console.log('Clicking "Fit" button...');
    await fitButton.click();

    // Give it a moment to finish the loop and log everything
    await page.waitForTimeout(3000);

  } catch (err) {
    console.error('Script failed:', err);
    await page.screenshot({ path: 'debug_fit_failure.png' });
    const content = await page.content();
    console.log('Page content length:', content.length);
  } finally {
    await browser.close();
  }
})();
