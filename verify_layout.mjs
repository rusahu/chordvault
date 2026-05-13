import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  async function report(message, success) {
    console.log(`${success ? '✅' : '❌'} ${message}`);
  }

  try {
    console.log('1. Opening http://localhost:5173/ and navigating to a song...');
    await page.goto('http://localhost:5173/');
    
    // Wait for song cards and click the first one
    await page.waitForSelector('.song-card');
    await page.click('.song-card');
    await page.waitForSelector('.chord-sheet-wrap');
    
    console.log('2. Checking if in 2-columns and clicking Reset...');
    // We'll click Reset anyway to ensure clean state
    const resetBtn = page.locator('.font-reset');
    if (await resetBtn.isVisible() && !(await resetBtn.isDisabled())) {
      await resetBtn.click();
      console.log('Reset button clicked.');
    } else {
      console.log('Reset button already disabled or not visible, likely in default state.');
    }

    console.log('3. Verifying default state...');
    const hasTwoCol = await page.evaluate(() => document.querySelector('.chord-sheet-wrap').classList.contains('two-col'));
    await report('Song is in 1-column mode', !hasTwoCol);

    // Font size check: we know 0 is default. Let's check if the class for font size is missing or at 0.
    // Based on ChordSheet.tsx (need to check), it likely adds a class or style.
    // Let's check ChordSheet.tsx
    const fontSizeStyle = await page.evaluate(() => document.querySelector('.chord-sheet-wrap').style.fontSize);
    // Actually, let's see how fontSize is applied in ChordSheet.tsx
    
    const overridden = await page.locator('.overridden').count();
    await report(`No "overridden" indicators (dots) on any buttons (Count: ${overridden})`, overridden === 0);

    console.log('4. Refreshing the page...');
    await page.reload();
    await page.waitForSelector('.chord-sheet-wrap');
    const hasTwoColAfterReload = await page.evaluate(() => document.querySelector('.chord-sheet-wrap').classList.contains('two-col'));
    await report('Still in 1-column mode after refresh', !hasTwoColAfterReload);

    console.log('5. Clicking 2-column button (||)...');
    await page.click('.col-toggle');
    const hasTwoColAfterToggle = await page.evaluate(() => document.querySelector('.chord-sheet-wrap').classList.contains('two-col'));
    await report('Switched to 2-columns', hasTwoColAfterToggle);
    
    const overriddenAfterToggle = await page.locator('.col-toggle.overridden').count();
    await report('Shows an "overridden" dot on 2-column button', overriddenAfterToggle > 0);

    console.log('6. Clicking Reset again...');
    await page.click('.font-reset');
    const hasTwoColAfterReset = await page.evaluate(() => document.querySelector('.chord-sheet-wrap').classList.contains('two-col'));
    await report('Returned to 1-column mode', !hasTwoColAfterReset);
    const overriddenAfterReset = await page.locator('.overridden').count();
    await report('Overridden dot disappeared', overriddenAfterReset === 0);

    console.log('7. Opening a Setlist...');
    await page.click('button:has-text("Setlists")');
    // Wait for setlist cards. They might also have .song-card class.
    await page.waitForSelector('.song-card');
    await page.click('.song-card');
    
    // Check if we are in setlist-play view
    await page.waitForSelector('.chord-sheet-wrap');
    const setlistTwoCol = await page.evaluate(() => document.querySelector('.chord-sheet-wrap').classList.contains('two-col'));
    await report('First song in setlist starts in 1-column', !setlistTwoCol);

  } catch (error) {
    console.error('An error occurred during verification:', error);
  } finally {
    await browser.close();
  }
})();
