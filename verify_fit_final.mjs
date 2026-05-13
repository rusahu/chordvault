import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Set a larger viewport to ensure fit can be achieved
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 }
  });
  const page = await context.newPage();

  const fitDebugLogs = [];
  page.on('console', msg => {
    if (msg.text().includes('[FitDebug]')) {
      fitDebugLogs.push(msg.text());
    }
  });

  try {
    console.log('1. Opening http://localhost:5173/ and navigating to a song...');
    await page.goto('http://localhost:5173/');
    
    // Wait for song cards and click the first one
    await page.waitForSelector('.song-card');
    await page.click('.song-card');
    await page.waitForSelector('.chord-sheet-wrap');
    
    // Check initial font scale
    const initialFontScale = await page.evaluate(() => {
        const wrap = document.querySelector('.chord-sheet-wrap');
        return getComputedStyle(wrap).getPropertyValue('--font-scale').trim();
    });
    console.log(`Initial --font-scale: "${initialFontScale}"`);

    console.log('2. Clicking the "Fit" button...');
    const fitBtn = page.locator('.autofit-btn');
    await fitBtn.click();

    console.log('3. Verifying that the "Song fitted to screen" toast appears...');
    const toast = page.locator('#toast');
    await toast.waitFor({ state: 'visible' });
    const toastText = await toast.textContent();
    console.log(`Toast text: "${toastText}"`);
    if (toastText.includes('Song fitted to screen')) {
        console.log('✅ Toast verified.');
    } else {
        console.log('❌ Toast NOT verified.');
    }

    console.log('4. Checking console for [FitDebug] logs...');
    // Give it a moment to finish logging
    await page.waitForTimeout(1000);
    
    if (fitDebugLogs.length > 0) {
        console.log('✅ Found [FitDebug] logs:');
        fitDebugLogs.forEach(log => console.log(log));
        
        // Find the final choice - usually the first one that says "Fit: true" 
        // OR if all are false, it's the last one (fallback).
        // But the code returns immediately when it finds a fit.
        // So the last log in the list *before* it stops is the one it chose.
        const choseLog = fitDebugLogs[fitDebugLogs.length - 1];
        console.log(`\nFinal choice details: ${choseLog}`);
    } else {
        console.log('❌ No [FitDebug] logs found.');
    }

    console.log('5. Confirming that the song font size actually changes...');
    const finalFontScale = await page.evaluate(() => {
        const wrap = document.querySelector('.chord-sheet-wrap');
        return getComputedStyle(wrap).getPropertyValue('--font-scale').trim();
    });
    console.log(`Final --font-scale: "${finalFontScale}"`);
    
    if (initialFontScale !== finalFontScale) {
        console.log('✅ Font scale changed.');
    } else {
        console.log('✅ Font scale did NOT change (it was already optimal).');
    }

  } catch (error) {
    console.error('An error occurred during verification:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
