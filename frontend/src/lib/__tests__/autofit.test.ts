import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { autoFit } from '../chords';

/**
 * jsdom performs no layout, so the sheet is simulated: one column of text at
 * font offset 0 is SINGLE_COL_HEIGHT tall, two columns halve it, and each font
 * step scales it by the same 1 + offset * 0.12 the CSS uses. Width is modelled
 * the same way, since a wider font or a narrower column can push a line off the
 * side.
 */
const SINGLE_COL_HEIGHT = 1200;
const SHEET_TOP = 150;
const WRAP_PADDING = 48;
const VIEWPORT = { width: 1024, height: 768 };

interface SheetOptions {
  singleColHeight?: number;
  sheetTop?: number;
  /** Natural width of the longest line at font 0, in px. */
  lineWidth?: number;
  /** Total page height. A real page scrolls, which jsdom does not model. */
  pageHeight?: number;
}

function mountSheet({
  singleColHeight = SINGLE_COL_HEIGHT,
  sheetTop = SHEET_TOP,
  lineWidth = 300,
  pageHeight = 5000,
}: SheetOptions = {}) {
  // Without this the page looks unscrollable, and a fit that wrongly assumes the
  // header can be scrolled away still passes.
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    get: () => pageHeight,
    configurable: true,
  });
  document.body.innerHTML = '<div class="chord-sheet-wrap"><div id="chord-output"></div></div>';
  const wrap = document.querySelector('.chord-sheet-wrap') as HTMLElement;
  const output = document.querySelector('#chord-output') as HTMLElement;

  const scale = () => Number(wrap.style.getPropertyValue('--font-scale') || 1);
  const columns = () => (wrap.classList.contains('two-col') ? 2 : 1);

  Object.defineProperty(output, 'scrollHeight', {
    get: () => Math.round((singleColHeight * scale()) / columns()),
  });
  // The wrap grows to its own content: this is what made the original height
  // test tautological, so the harness has to reproduce it.
  Object.defineProperty(wrap, 'clientHeight', {
    get: () => output.scrollHeight + WRAP_PADDING,
  });
  Object.defineProperty(wrap, 'clientWidth', {
    get: () => VIEWPORT.width - WRAP_PADDING,
  });
  Object.defineProperty(wrap, 'scrollWidth', {
    get: () => {
      const columnWidth = (VIEWPORT.width - WRAP_PADDING) / columns();
      const needed = lineWidth * scale();
      return needed > columnWidth ? VIEWPORT.width - WRAP_PADDING + (needed - columnWidth) : VIEWPORT.width - WRAP_PADDING;
    },
  });
  output.getBoundingClientRect = () => ({ top: sheetTop }) as DOMRect;
  return { wrap, output };
}

function setViewport(width: number, height: number) {
  VIEWPORT.width = width;
  VIEWPORT.height = height;
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

/** What the fitted layout actually occupies, the way the screen would show it. */
function renderedHeight(fontSize: number, twoCol: boolean, singleColHeight = SINGLE_COL_HEIGHT) {
  return Math.round((singleColHeight * (1 + fontSize * 0.12)) / (twoCol ? 2 : 1));
}

describe('autoFit', () => {
  beforeEach(() => setViewport(1024, 768));
  afterEach(() => { document.body.innerHTML = ''; });

  it('uses two columns when one column does not fit', () => {
    mountSheet();
    expect(autoFit().twoCol).toBe(true);
  });

  it('fits in the space the sheet actually has, not a whole screen', () => {
    mountSheet();
    const { fontSize, twoCol } = autoFit();
    const available = 768 - SHEET_TOP - 24;

    expect(renderedHeight(fontSize, twoCol)).toBeLessThanOrEqual(available);
  });

  it('takes the largest font that fits', () => {
    mountSheet();
    const { fontSize, twoCol } = autoFit();
    const available = 768 - SHEET_TOP - 24;

    expect(renderedHeight(fontSize + 1, twoCol)).toBeGreaterThan(available);
  });

  it('shrinks when the sheet sits lower down the page', () => {
    mountSheet({ sheetTop: 100 });
    const high = autoFit();
    document.body.innerHTML = '';
    mountSheet({ sheetTop: 500 });

    expect(autoFit().fontSize).toBeLessThanOrEqual(high.fontSize);
  });

  it('enlarges a short song', () => {
    mountSheet({ singleColHeight: 200 });
    expect(autoFit().fontSize).toBeGreaterThan(0);
  });

  it('never enlarges a song off the side of the screen', () => {
    // A line already close to the full width cannot survive being enlarged.
    mountSheet({ singleColHeight: 100, lineWidth: 950 });
    const { fontSize, twoCol } = autoFit();

    const columnWidth = (1024 - WRAP_PADDING) / (twoCol ? 2 : 1);
    expect(950 * (1 + fontSize * 0.12)).toBeLessThanOrEqual(columnWidth);
  });

  it('drops to one column when two would split a line off the side', () => {
    // Fits vertically either way, but only one column is wide enough.
    mountSheet({ singleColHeight: 100, lineWidth: 600 });
    expect(autoFit().twoCol).toBe(false);
  });

  it('stays at the readable default when nothing fits', () => {
    mountSheet({ singleColHeight: 99999 });
    expect(autoFit().fontSize).toBe(0);
  });

  it('leaves the column count alone when nothing fits', () => {
    const { wrap } = mountSheet({ singleColHeight: 99999 });
    expect(autoFit().twoCol).toBe(false);

    wrap.classList.add('two-col');
    expect(autoFit().twoCol).toBe(true);
  });

  it('never returns two columns on a narrow screen', () => {
    setViewport(390, 844);
    mountSheet();
    expect(autoFit().twoCol).toBe(false);
  });

  it('is idempotent: fitting an already fitted sheet changes nothing', () => {
    const { wrap } = mountSheet();
    const first = autoFit();
    // Apply the result the way the views do, then fit again.
    wrap.classList.toggle('two-col', first.twoCol);
    if (first.fontSize) wrap.style.setProperty('--font-scale', String(1 + first.fontSize * 0.12));

    expect(autoFit()).toEqual(first);
  });

  it('leaves the sheet markup exactly as it found it', () => {
    const { wrap } = mountSheet();
    wrap.classList.add('two-col');
    wrap.style.setProperty('--font-scale', '1.24');

    autoFit();

    expect(wrap.classList.contains('two-col')).toBe(true);
    expect(wrap.style.getPropertyValue('--font-scale')).toBe('1.24');
  });

  it('survives a sheet pushed entirely below the fold', () => {
    mountSheet({ sheetTop: 2000 });
    expect(autoFit()).toEqual({ fontSize: 0, twoCol: false });
  });

  it('returns a neutral layout when no sheet is mounted', () => {
    document.body.innerHTML = '';
    expect(autoFit()).toEqual({ fontSize: 0, twoCol: false });
  });
});
