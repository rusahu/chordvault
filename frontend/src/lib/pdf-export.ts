import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { fontScaleValue, getSongKey, renderChordPro, slEffective } from './chords';
import type { Setlist } from '../types/setlist';

// Letter page dimensions in points (jsPDF units)
const PAGE_W = 612;   // 8.5 in
const PAGE_H = 792;   // 11 in
const MARGIN = 36;     // ~0.5 in
const CONTENT_W = PAGE_W - 2 * MARGIN;
const CONTENT_H = PAGE_H - 2 * MARGIN;

// Offscreen container width in pixels — determines render width before capture
const CONTAINER_PX = 720;
const CAPTURE_SCALE = 2;

function createOffscreenContainer(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  el.style.top = '0';
  el.style.width = `${CONTAINER_PX}px`;
  el.style.background = 'var(--surface)';
  el.style.padding = '12px';
  document.body.appendChild(el);
  return el;
}

function buildSongHeader(
  title: string,
  artist: string,
  key?: string,
  bpm?: number | null,
  position?: string,
): HTMLDivElement {
  const header = document.createElement('div');
  header.style.fontFamily = 'Outfit, sans-serif';
  header.style.marginBottom = '16px';
  header.style.paddingBottom = '8px';
  header.style.borderBottom = '2px solid var(--accent)';

  const titleEl = document.createElement('div');
  titleEl.style.fontSize = '22px';
  titleEl.style.fontWeight = '600';
  titleEl.style.color = 'var(--text)';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  if (artist) {
    const artistEl = document.createElement('div');
    artistEl.style.fontSize = '14px';
    artistEl.style.color = 'var(--muted)';
    artistEl.textContent = artist;
    header.appendChild(artistEl);
  }

  const meta: string[] = [];
  if (key) meta.push(`Key: ${key}`);
  if (bpm) meta.push(`${bpm} BPM`);
  if (position) meta.push(position);

  if (meta.length) {
    const metaEl = document.createElement('div');
    metaEl.style.display = 'flex';
    metaEl.style.gap = '12px';
    metaEl.style.fontSize = '12px';
    metaEl.style.color = 'var(--muted)';
    metaEl.style.marginTop = '4px';
    meta.forEach((m) => {
      const span = document.createElement('span');
      span.textContent = m;
      metaEl.appendChild(span);
    });
    header.appendChild(metaEl);
  }

  return header;
}

function buildChordSheetDom(renderedHtml: string, fontSize: number): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'chord-sheet-wrap';
  const fontScale = fontScaleValue(fontSize || 0);
  if (fontScale) wrap.style.setProperty('--font-scale', fontScale);
  // Strip decorative wrapper styling for PDF — no border, background, or excess padding
  wrap.style.border = 'none';
  wrap.style.background = 'none';
  wrap.style.padding = '0';
  wrap.style.borderRadius = '0';
  wrap.style.boxShadow = 'none';

  const output = document.createElement('div');
  output.id = 'pdf-chord-output'; // unique id — avoids conflict with #chord-output on visible page
  output.style.paddingBottom = '8px';
  // renderedHtml is trusted output from ChordSheetJS HtmlDivFormatter (same as ChordSheet.tsx)
  output.innerHTML = renderedHtml;
  wrap.appendChild(output);
  return wrap;
}

function buildSetlistHeader(name: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.fontFamily = 'Outfit, sans-serif';
  el.style.fontSize = '12px';
  el.style.color = 'var(--muted)';
  el.style.marginBottom = '8px';
  el.textContent = name;
  return el;
}

// Max content height in pixels that fits one PDF page (based on container width and page aspect ratio)
const PAGE_CONTENT_PX = CONTAINER_PX * (CONTENT_H / CONTENT_W);

// Auto-fit: if content overflows one page, try 2-column + font shrink to fit on one page.
// Mutates the chord-sheet-wrap element in place. Similar to the app's autoFit() function.
function autoFitForPdf(container: HTMLElement): void {
  if (container.scrollHeight <= PAGE_CONTENT_PX) return; // already fits

  const wrap = container.querySelector('.chord-sheet-wrap') as HTMLElement | null;
  const output = wrap?.querySelector('#pdf-chord-output') as HTMLElement | null;
  if (!wrap || !output) return;

  // Try 2-column (apply via inline style since CSS selector targets #chord-output not #pdf-chord-output)
  output.style.columnCount = '2';
  output.style.columnGap = '32px';

  // Add break-inside: avoid to all paragraphs
  const paragraphs = output.querySelectorAll('.paragraph');
  paragraphs.forEach((p) => (p as HTMLElement).style.breakInside = 'avoid');

  if (container.scrollHeight <= PAGE_CONTENT_PX) return; // fits with 2-col

  // Try shrinking font with 2-column
  for (let offset = -1; offset >= -3; offset--) {
    wrap.style.setProperty('--font-scale', String(1 + offset * 0.12));
    if (container.scrollHeight <= PAGE_CONTENT_PX) return;
  }

  // Doesn't fit even at smallest font + 2-col — revert to let pagination handle it
  output.style.columnCount = '';
  output.style.columnGap = '';
  wrap.style.removeProperty('--font-scale');
}

async function captureToCanvas(container: HTMLElement): Promise<HTMLCanvasElement> {
  // Wait for web fonts with timeout
  await Promise.race([
    document.fonts.ready,
    new Promise((r) => setTimeout(r, 3000)),
  ]);

  return html2canvas(container, {
    scale: CAPTURE_SCALE,
    backgroundColor: null,
    logging: false,
    useCORS: true,
  });
}

// Find safe page break points by measuring paragraph boundaries in the offscreen container.
// Returns Y positions (in canvas pixels at 2x scale) where it's safe to slice.
function findBreakPoints(container: HTMLElement, scale: number, maxSliceH: number): number[] {
  const containerRect = container.getBoundingClientRect();
  const chordWrap = container.querySelector('.chord-sheet-wrap');
  // Collect breakable elements: song header divs + individual paragraphs from chord output
  const elements: Element[] = [];
  for (const child of container.children) {
    if (child === chordWrap) {
      // Drill into .chord-sheet-wrap > #pdf-chord-output > .chord-sheet to get each paragraph
      const output = chordWrap.querySelector('#pdf-chord-output > .chord-sheet') || chordWrap.querySelector('#pdf-chord-output');
      if (output) {
        for (const el of output.children) elements.push(el);
      }
    } else {
      elements.push(child);
    }
  }

  // Get the bottom Y of each element (in canvas pixels)
  const bottoms = elements.map((el) => {
    const rect = el.getBoundingClientRect();
    return Math.round((rect.bottom - containerRect.top) * scale);
  });

  // Walk through bottoms and find where a page break should go.
  // When the next element would overflow the page, break at the previous element's bottom.
  // Never break before index 2 — keeps the song header grouped with the first paragraph.
  const breaks: number[] = [];
  let prevBottom = 0;

  for (let i = 0; i < bottoms.length; i++) {
    const bottom = bottoms[i];
    if (bottom - (breaks[breaks.length - 1] ?? 0) > maxSliceH && prevBottom > 0 && i >= 2) {
      breaks.push(prevBottom);
    }
    prevBottom = bottom;
  }

  return breaks;
}

// Get the current theme's surface color as RGB for jsPDF
function getPageBgColor(): [number, number, number] {
  const style = getComputedStyle(document.documentElement);
  const surface = style.getPropertyValue('--surface').trim();
  // Parse hex or rgb
  const hex = surface.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
  const rgb = surface.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgb) return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3])];
  return [37, 37, 48]; // fallback dark
}

function fillPageBg(pdf: jsPDF, bgColor: [number, number, number]): void {
  const [r, g, b] = bgColor;
  pdf.setFillColor(r, g, b);
  pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');
}

function addCanvasToPages(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  scale: number,
  isFirstSong: boolean,
  bgColor: [number, number, number],
): void {
  const imgWidth = CONTENT_W;
  const imgHeight = (canvas.height / canvas.width) * imgWidth;

  // Scale to fit on one page if possible (allow up to 30% shrink, i.e. scale >= 0.7)
  const fitScale = CONTENT_H / imgHeight;
  if (fitScale >= 0.7) {
    if (!isFirstSong) pdf.addPage();
    fillPageBg(pdf, bgColor);
    const fitWidth = imgWidth * Math.min(fitScale, 1);
    const fitHeight = Math.min(imgHeight, CONTENT_H);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, fitWidth, fitHeight);
    return;
  }

  // Calculate max canvas pixels per page
  const pxPerPage = (CONTENT_H / imgHeight) * canvas.height;

  // Find smart break points at paragraph boundaries
  let breakYs = findBreakPoints(container, scale, pxPerPage);

  // Fallback: if no smart breaks found but content overflows, use fixed-height slicing
  if (breakYs.length === 0) {
    let y = pxPerPage;
    while (y < canvas.height) {
      breakYs.push(Math.round(y));
      y += pxPerPage;
    }
  }

  // Build slice ranges from break points
  const sliceStarts = [0, ...breakYs];
  const sliceEnds = [...breakYs, canvas.height];

  // Flatten slices: if any slice exceeds page height, sub-split with fixed-height cuts
  const finalSlices: Array<{ srcY: number; sliceH: number }> = [];
  for (let i = 0; i < sliceStarts.length; i++) {
    let srcY = sliceStarts[i];
    const endY = sliceEnds[i];
    while (srcY < endY) {
      const sliceH = Math.min(pxPerPage, endY - srcY);
      if (sliceH > 0) finalSlices.push({ srcY, sliceH });
      srcY += sliceH;
    }
  }

  for (let i = 0; i < finalSlices.length; i++) {
    const { srcY, sliceH } = finalSlices[i];

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (i > 0 || !isFirstSong) pdf.addPage();
    fillPageBg(pdf, bgColor); // fill every page with theme background
    const destH = (sliceH / canvas.height) * imgHeight;
    pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, imgWidth, destH);
  }
}

interface SongData {
  title: string;
  artist: string;
  content: string;
  bpm: number | null;
}

interface SongExportOptions {
  transpose: number;
  fontSize: number;
}

export async function exportSongPdf(
  song: SongData,
  renderedHtml: string,
  options: SongExportOptions,
): Promise<void> {
  const container = createOffscreenContainer();

  try {
    const key = getSongKey(song.content, options.transpose);
    container.appendChild(buildSongHeader(song.title, song.artist, key, song.bpm));
    container.appendChild(buildChordSheetDom(renderedHtml, options.fontSize));
    autoFitForPdf(container);

    const bgColor = getPageBgColor();
    const canvas = await captureToCanvas(container);
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    addCanvasToPages(pdf, canvas, container, CAPTURE_SCALE, true, bgColor);

    const filename = [song.title, song.artist].filter(Boolean).join(' - ');
    pdf.save(`${filename || 'song'}.pdf`);
  } finally {
    container.remove();
  }
}

export async function exportSetlistPdf(
  setlist: Setlist,
  globalSettings: { nashville: boolean; fontSize: number },
): Promise<void> {
  const entries = setlist.entries.filter((e) => !e.is_private_placeholder);
  if (!entries.length) throw new Error('No exportable songs in this setlist');

  const bgColor = getPageBgColor();
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const effNash = slEffective(entry, 'num', globalSettings.nashville ? 1 : 0);
    const effFont = slEffective(entry, 'font', globalSettings.fontSize) as number;
    const content = entry.content_override || entry.content;
    const html = renderChordPro(content, entry.transpose, !!effNash);

    const container = createOffscreenContainer();
    try {
      if (i === 0) container.appendChild(buildSetlistHeader(setlist.name));

      const key = getSongKey(content, entry.transpose);
      container.appendChild(
        buildSongHeader(entry.title, entry.artist, key, entry.bpm, `Song ${i + 1}/${total}`),
      );
      container.appendChild(buildChordSheetDom(html, effFont));
      autoFitForPdf(container);

      const canvas = await captureToCanvas(container);
      addCanvasToPages(pdf, canvas, container, CAPTURE_SCALE, i === 0, bgColor);
    } finally {
      container.remove();
    }
  }

  pdf.save(`${setlist.name || 'setlist'}.pdf`);
}
