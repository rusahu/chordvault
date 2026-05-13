import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');

  console.log('--- Initial Page Load ---');
  const lsTwoCol = await page.evaluate(() => localStorage.getItem('cv_twocol'));
  console.log('localStorage cv_twocol:', lsTwoCol);

  // Navigate to a song (assuming there's at least one song)
  // We'll wait for the song card to appear and click it
  await page.waitForSelector('.song-card');
  await page.click('.song-card');
  await page.waitForSelector('.chord-sheet-wrap');

  console.log('--- Song View ---');
  const hasTwoColClass = await page.evaluate(() => document.querySelector('.chord-sheet-wrap').classList.contains('two-col'));
  console.log('DOM .chord-sheet-wrap has two-col class:', hasTwoColClass);

  const lsTwoColAfter = await page.evaluate(() => localStorage.getItem('cv_twocol'));
  console.log('localStorage cv_twocol after navigation:', lsTwoColAfter);

  // Check if Fit button is active
  const isFitActive = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.toolbar-btn')).find(b => b.textContent.includes('Fit'));
    return btn ? btn.classList.contains('active') : 'Not found';
  });
  console.log('Fit button active:', isFitActive);

  // Navigate to a Setlist
  await page.click('button:has-text("Setlists")');
  await page.waitForSelector('.song-card'); // assuming setlist cards also have song-card class or similar
  const hasSetlist = await page.evaluate(() => !!document.querySelector('.song-card'));
  if (hasSetlist) {
      await page.click('.song-card');
      // Wait for playback if it's not auto-playing, or click play
      // Based on CHORDVAULT_CONTEXT, setlist-edit serves as public view, 
      // but maybe we need to click "Play" or something.
      // Let's see if we are in setlist-play view
      await page.waitForTimeout(1000);
      const url = page.url();
      console.log('Current URL:', url);
      
      if (url.includes('/play')) {
          await page.waitForSelector('.chord-sheet-wrap');
          const setlistTwoCol = await page.evaluate(() => document.querySelector('.chord-sheet-wrap').classList.contains('two-col'));
          console.log('Setlist Playback: .chord-sheet-wrap has two-col class:', setlistTwoCol);
      } else {
          // Try to click a "Play" button if it exists
          const playBtn = await page.evaluate(() => {
              const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('play'));
              if (btn) { btn.click(); return true; }
              return false;
          });
          if (playBtn) {
              await page.waitForSelector('.chord-sheet-wrap');
              const setlistTwoCol = await page.evaluate(() => document.querySelector('.chord-sheet-wrap').classList.contains('two-col'));
              console.log('Setlist Playback (after click Play): .chord-sheet-wrap has two-col class:', setlistTwoCol);
          }
      }
  }

  await browser.close();
})();
