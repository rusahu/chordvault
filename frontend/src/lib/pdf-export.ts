import { PdfFormatter } from 'chordsheetjs/pdf';
import { PDFDocument } from 'pdf-lib';
import { prepareSong, resolveEffectivePreferences } from './chords';
import { buildPdfConfig } from './pdf-config';
import { EMBEDDED_FONT } from './constants';
import { loadPdfFont, makePdfConstructor, unsupportedChars } from './pdf-fonts';
import type { Setlist } from '../types/setlist';

// The library breaks pages mid-verse, so keep a song on one page where we can.
// Floor matches the app's own font scale.
const FIT_FLOOR = -3;

function download(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadFontFor(content: string): Promise<string | null> {
  try {
    return await loadPdfFont(content);
  } catch {
    throw new Error('Could not load the font needed for this song');
  }
}

async function renderOne(
  content: string,
  transpose: number,
  nashville: boolean,
  fontSize: number,
): Promise<Uint8Array> {
  const song = prepareSong(content, transpose, nashville);
  if (!song) throw new Error('Could not parse this song');

  const fontBase64 = await loadFontFor(content);
  const Doc = makePdfConstructor(fontBase64);
  const fontName = fontBase64 ? EMBEDDED_FONT : null;

  // chordsheetjs and chordsheetjs/pdf each declare their own Song class, so the
  // types don't match across entry points even though it's one object at runtime.
  const forPdf = song as unknown as Parameters<PdfFormatter['format']>[0];

  let requested: Uint8Array | null = null;
  for (let size = fontSize; ; size--) {
    const formatter = new PdfFormatter(buildPdfConfig({ fontName, fontSize: size }));
    formatter.format(forPdf, Doc);
    const wrapper = formatter.getDocumentWrapper();
    const bytes = new Uint8Array(wrapper.doc.output('arraybuffer'));
    requested ??= bytes;
    if (wrapper.totalPages === 1) return bytes;
    // Shrinking did not rescue it — don't punish the reader with tiny text.
    if (size <= FIT_FLOOR) return requested;
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
  nashville: boolean;
  fontSize: number;
}

/** Resolves to the characters no available font can draw (empty when all is well). */
export async function exportSongPdf(song: SongData, options: SongExportOptions): Promise<string[]> {
  const bytes = await renderOne(song.content, options.transpose, options.nashville, options.fontSize);
  const name = [song.title, song.artist].filter(Boolean).join(' - ') || 'song';
  download(bytes, `${name}.pdf`);
  return unsupportedChars(song.content);
}

export async function exportSetlistPdf(
  setlist: Setlist,
  globalSettings: { nashville: boolean; fontSize: number },
): Promise<string[]> {
  const entries = setlist.entries.filter((e) => !e.is_private_placeholder);
  if (!entries.length) throw new Error('No exportable songs in this setlist');

  const missing = new Set<string>();
  const parts: Uint8Array[] = [];

  for (const entry of entries) {
    const prefs = resolveEffectivePreferences(entry, {
      nashville: !!globalSettings.nashville,
      twoCol: false,
      fontSize: globalSettings.fontSize,
      hideYt: false,
      hideChords: false,
    });
    const content = entry.content_override || entry.content;
    parts.push(await renderOne(content, entry.transpose, prefs.nashville, prefs.fontSize));
    unsupportedChars(content).forEach((c) => missing.add(c));
  }

  const merged = await PDFDocument.create();
  for (const part of parts) {
    const src = await PDFDocument.load(part);
    (await merged.copyPages(src, src.getPageIndices())).forEach((p) => merged.addPage(p));
  }

  download(await merged.save(), `${setlist.name || 'setlist'}.pdf`);
  return [...missing];
}
