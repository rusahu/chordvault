import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { autoFit } from '../chords';

/**
 * jsdom performs no layout, so the sheet's height is simulated: one column of
 * text at font offset 0 is SINGLE_COL_HEIGHT tall, two columns halve it, and
 * each font step scales it by the same 1 + offset * 0.12 the CSS uses.
 */
const SINGLE_COL_HEIGHT = 1200;
const SHEET_TOP = 150;
const WRAP_PADDING = 48;

/** A page tall enough to scroll the sheet all the way to the top. */
const SCROLLABLE_PAGE = 5000;

function mountSheet(singleColHeight = SINGLE_COL_HEIGHT, sheetTop = SHEET_TOP, pageHeight = SCROLLABLE_PAGE) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    get: () => pageHeight,
    configurable: true,
  });
  document.body.innerHTML = '<div class="chord-sheet-wrap"><div id="chord-output"></div></div>';
  const wrap = document.querySelector('.chord-sheet-wrap') as HTMLElement;
  const output = document.querySelector('#chord-output') as HTMLElement;

  Object.defineProperty(output, 'scrollHeight', {
    get() {
      const scale = Number(wrap.style.getPropertyValue('--font-scale') || 1);
      const columns = wrap.classList.contains('two-col') ? 2 : 1;
      return Math.round((singleColHeight * scale) / columns);
    },
  });
  // The wrap has no height constraint in either view, so it grows to exactly
  // its own content plus padding. Modelling that is the whole point: it is
  // what made the old height test tautological.
  Object.defineProperty(wrap, 'clientHeight', {
    get: () => output.scrollHeight + WRAP_PADDING,
  });
  output.getBoundingClientRect = () => ({ top: sheetTop }) as DOMRect;

  return { wrap, output };
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

describe('autoFit', () => {
  beforeEach(() => setViewport(1024, 768));
  afterEach(() => { document.body.innerHTML = ''; });

  it('uses two columns when one column overflows the viewport', () => {
    mountSheet();
    // 1200px of text, 594px of usable screen: one column cannot fit at any size.
    expect(autoFit().twoCol).toBe(true);
  });

  it('picks the largest font that actually fits', () => {
    mountSheet();
    const { fontSize, twoCol } = autoFit();
    const fittedHeight = (1200 * (1 + fontSize * 0.12)) / (twoCol ? 2 : 1);
    const available = 768 - 24 * 2;

    expect(fittedHeight).toBeLessThanOrEqual(available);
    // One step larger must overflow, or we settled for less than we could read.
    const nextUp = (1200 * (1 + (fontSize + 1) * 0.12)) / (twoCol ? 2 : 1);
    expect(nextUp).toBeGreaterThan(available);
  });

  it('enlarges a short song rather than leaving it at the default size', () => {
    mountSheet(200);
    expect(autoFit().fontSize).toBeGreaterThan(0);
  });

  it('never returns two columns on a narrow screen', () => {
    setViewport(390, 844);
    mountSheet();
    expect(autoFit().twoCol).toBe(false);
  });

  it('falls back to the smallest font when nothing fits', () => {
    mountSheet(99999);
    expect(autoFit().fontSize).toBe(-3);
  });

  it('leaves the sheet markup exactly as it found it', () => {
    const { wrap } = mountSheet();
    wrap.classList.add('two-col');
    wrap.style.setProperty('--font-scale', '1.24');

    autoFit();

    expect(wrap.classList.contains('two-col')).toBe(true);
    expect(wrap.style.getPropertyValue('--font-scale')).toBe('1.24');
  });

  it('ignores how far down the page the sheet sits', () => {
    mountSheet(SINGLE_COL_HEIGHT, 40);
    const high = autoFit();
    document.body.innerHTML = '';
    mountSheet(SINGLE_COL_HEIGHT, 600);
    // The header above the sheet is scrolled away, so it buys no screen estate.
    expect(autoFit()).toEqual(high);
  });

  it('gives back screen estate a short page cannot scroll away', () => {
    // The page cannot scroll at all, so the header above the sheet really does
    // cost screen estate and less of the song fits.
    mountSheet(SINGLE_COL_HEIGHT, SHEET_TOP, 768);
    const stuck = autoFit();
    document.body.innerHTML = '';
    mountSheet(SINGLE_COL_HEIGHT, SHEET_TOP, SCROLLABLE_PAGE);

    expect(stuck.fontSize).toBeLessThan(autoFit().fontSize);
  });

  it('returns a neutral layout when no sheet is mounted', () => {
    document.body.innerHTML = '';
    expect(autoFit()).toEqual({ fontSize: 0, twoCol: false });
  });
});
