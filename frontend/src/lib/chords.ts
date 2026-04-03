import * as ChordSheetJS from 'chordsheetjs';
import { escHtml } from './util';
import type { SetlistEntry } from '../types';

const PARSER_NAMES = [
  { cls: 'ChordProParser', label: 'ChordPro' },
  { cls: 'UltimateGuitarParser', label: 'Ultimate Guitar' },
  { cls: 'ChordsOverWordsParser', label: 'Chords over lyrics' },
] as const;

type ParserCls = 'ChordProParser' | 'UltimateGuitarParser' | 'ChordsOverWordsParser';

export function parseSongAutoWithFormat(content: string): { song: ChordSheetJS.Song; format: string | null } | null {
  // Detect true ChordPro bracket chords — exclude section labels like [Chorus], [Bridge]
  const SECTION_LABEL = /^(?:Verse|Chorus|Bridge|Intro|Outro|Interlude|Pre-?Chorus|Ending|Tag|Coda|Break|Solo|Instrumental|Refrain)\s*\d*$/i;
  const bracketContents = (content.match(/\[([A-G][^\]]*)\]/g) || []).map(b => b.slice(1, -1));
  const hasBracketChords = bracketContents.some(c => !SECTION_LABEL.test(c));

  // ChordPro directives like {start_of_verse} or {key: C}
  const hasDirectives = /\{[a-z_]+[:}]/.test(content);

  // Use ChordPro parser when content has real inline [chord] markers or {directives} without chords-over-lyrics
  const hasChordsOverLyrics = /^\s*[A-G][b#]?\S*(?:\s+[A-G][b#]?\S*)+\s*$/m.test(content);
  const isChordPro = hasBracketChords || (hasDirectives && !hasChordsOverLyrics);
  const order = isChordPro ? [0, 1, 2] : [1, 2, 0];

  for (const idx of order) {
    const p = PARSER_NAMES[idx];
    const ParserClass = (ChordSheetJS as Record<string, unknown>)[p.cls] as
      (new (opts?: { preserveWhitespace?: boolean }) => { parse(s: string): ChordSheetJS.Song }) | undefined;
    if (!ParserClass) continue;
    try {
      const song = new ParserClass({ preserveWhitespace: false }).parse(content);
      const hasChords = song.paragraphs.some((par) =>
        par.lines.some((l) =>
          l.items.some((it) => !!(it as { chords?: string }).chords)
        )
      );
      if (hasChords) return { song, format: p.label };
    } catch { /* try next parser */ }
  }

  // Fallback: parse as ChordPro (lyrics only, no chords detected)
  try {
    return { song: new ChordSheetJS.ChordProParser().parse(content), format: null };
  } catch { /* fall through */ }
  return null;
}

export function parseSongAuto(content: string): ChordSheetJS.Song | null {
  const result = parseSongAutoWithFormat(content);
  return result ? result.song : null;
}

export function detectFormat(content: string): string | null {
  if (!content || !content.trim()) return null;
  const result = parseSongAutoWithFormat(content);
  return result ? result.format : null;
}

export function toChordPro(content: string): string {
  const song = parseSongAuto(content);
  if (!song) return content;
  try {
    return new ChordSheetJS.ChordProFormatter({ normalizeChords: false } as Record<string, unknown>).format(song);
  } catch { return content; }
}

export function ensureKeyDirective(content: string): string {
  if (/\{key:\s*\S/.test(content)) return content;
  try {
    const song = new ChordSheetJS.ChordProParser().parse(content);
    for (const p of song.paragraphs) {
      for (const line of p.lines) {
        for (const item of line.items) {
          const chords = (item as { chords?: string }).chords;
          if (chords && chords.trim()) {
            const m = chords.trim().match(/^([A-G][b#]?m?)/);
            if (m) return `{key: ${m[1]}}\n${content}`;
          }
        }
      }
    }
  } catch { /* fall through */ }
  return content;
}

export function renderChordPro(content: string, semitones = 0, nashville = false): string {
  try {
    const song = parseSongAuto(content);
    if (!song) throw new Error('parse failed');

    let transposed = semitones !== 0 ? song.transpose(semitones) : song;
    const keyRaw = transposed.key || (transposed.getMetadataValue ? transposed.getMetadataValue('key') : null);
    const key = typeof keyRaw === 'string' ? keyRaw : keyRaw?.toString() || null;

    if (nashville && key && ChordSheetJS.Chord && ChordSheetJS.ChordSheetSerializer) {
      const serializer = new ChordSheetJS.ChordSheetSerializer();
      const cloned = serializer.deserialize(serializer.serialize(transposed));
      convertToNashville(cloned, key as string);
      transposed = cloned;
    }

    const FormatterClass = ChordSheetJS.HtmlDivFormatter || (ChordSheetJS as Record<string, unknown>).HtmlFormatter as typeof ChordSheetJS.HtmlDivFormatter;
    const html = new FormatterClass({ normalizeChords: false } as Record<string, unknown>).format(transposed)
      .replace(/<h1[^>]*>.*?<\/h1>/gi, '')
      .replace(
        /<div class="paragraph (chorus|verse|bridge|prechorus|pre-chorus|outro|intro|interlude)">(?!<div class="row"><h3 class="label">)/gi,
        (match, section: string) => {
          const LABELS: Record<string, string> = { prechorus: 'Pre-Chorus' };
          const label = LABELS[section.toLowerCase()] ?? section.charAt(0).toUpperCase() + section.slice(1);
          return `${match}<div class="row"><h3 class="label">${label}</h3></div>`;
        }
      );
    return `<div class="chord-sheet">${html}</div>`;
  } catch {
    return `<pre style="font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;color:var(--text)">${escHtml(content)}</pre>`;
  }
}

export function convertToNashville(song: ChordSheetJS.Song, key: string): ChordSheetJS.Song {
  song.paragraphs.forEach((p) => {
    p.lines.forEach((line) => {
      line.items.forEach((item) => {
        const it = item as { chords?: string };
        if (it.chords) {
          try {
            const c = ChordSheetJS.Chord.parse(it.chords);
            if (c) it.chords = c.toNumeric(key).toString();
          } catch { /* skip */ }
        }
      });
    });
  });
  return song;
}

export function getSongKey(content: string, semitones = 0): string {
  try {
    const parser = new ChordSheetJS.ChordProParser();
    const song = parser.parse(content);
    const transposed = semitones !== 0 ? song.transpose(semitones) : song;
    const keyRaw = transposed.key || (transposed.getMetadataValue ? transposed.getMetadataValue('key') : null);
    const key = typeof keyRaw === 'string' ? keyRaw : keyRaw?.toString() || null;
    if (key) return key;
    // Fallback: derive key from first chord
    for (const p of transposed.paragraphs) {
      for (const line of p.lines) {
        for (const item of line.items) {
          const chords = (item as { chords?: string }).chords;
          if (chords && chords.trim()) {
            const m = chords.trim().match(/^([A-G][b#]?m?)/);
            if (m) return m[1];
          }
        }
      }
    }
  } catch { /* fall through */ }
  return '';
}

export function songHasKey(content: string, semitones: number): boolean {
  try {
    const song = new ChordSheetJS.ChordProParser().parse(content);
    const transposed = semitones ? song.transpose(semitones) : song;
    return !!(transposed.key || (transposed.getMetadataValue ? transposed.getMetadataValue('key') : null));
  } catch { return false; }
}

export { escHtml } from './util';

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

export function clampFontSize(val: number): number {
  return Math.max(-3, Math.min(5, val));
}

export function fontScaleValue(offset: number): string | undefined {
  return offset ? String(1 + offset * 0.12) : undefined;
}

export function autoFit(): { fontSize: number; twoCol: boolean } {
  const wrap = document.querySelector('.chord-sheet-wrap') as HTMLElement | null;
  if (!wrap) return { fontSize: 0, twoCol: false };

  const output = wrap.querySelector('#chord-output') as HTMLElement | null;
  if (!output) return { fontSize: 0, twoCol: false };

  const wasTwoCol = wrap.classList.contains('two-col');
  const prevScale = wrap.style.getPropertyValue('--font-scale');

  const tryFit = (offset: number, twoCol: boolean): boolean => {
    // Apply settings and measure actual layout
    if (twoCol) wrap.classList.add('two-col');
    else wrap.classList.remove('two-col');
    if (offset) wrap.style.setProperty('--font-scale', String(1 + offset * 0.12));
    else wrap.style.removeProperty('--font-scale');

    const available = window.innerHeight - wrap.getBoundingClientRect().top;
    return output.scrollHeight <= available;
  };

  // Try single-column first, shrinking font
  for (let offset = 0; offset >= -3; offset--) {
    if (tryFit(offset, false)) {
      return { fontSize: clampFontSize(offset), twoCol: false };
    }
  }

  // Fall back to 2-column
  for (let offset = 0; offset >= -3; offset--) {
    if (tryFit(offset, true)) {
      return { fontSize: clampFontSize(offset), twoCol: true };
    }
  }

  // Restore original state before returning fallback
  if (wasTwoCol) wrap.classList.add('two-col');
  else wrap.classList.remove('two-col');
  if (prevScale) wrap.style.setProperty('--font-scale', prevScale);
  else wrap.style.removeProperty('--font-scale');

  return { fontSize: clampFontSize(-3), twoCol: true };
}


export function slEffective<T>(
  entry: SetlistEntry,
  key: 'num' | 'twoCol' | 'font' | 'hideYt',
  globalVal: T
): T {
  const keyMap = { num: '_num', twoCol: '_twoCol', font: '_font', hideYt: '_hideYt' } as const;
  const ov = entry[keyMap[key]];
  return (ov != null ? ov : globalVal) as T;
}
