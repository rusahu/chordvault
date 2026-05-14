import * as ChordSheetJS from 'chordsheetjs';
import { escHtml } from './util';
import { normalizeKey, normalizeChord } from './keys';
import type { SetlistEntry } from '../types';

const PARSER_NAMES = [
  { cls: 'ChordProParser', label: 'ChordPro' },
  { cls: 'UltimateGuitarParser', label: 'Ultimate Guitar' },
  { cls: 'ChordsOverWordsParser', label: 'Chords over lyrics' },
] as const;


const DIRECTIVE_RE = /^\{([a-z_]+):\s*([^}]*)\}$/i;
const DIRECTIVE_LINE_RE = /^\{[a-z_]+:.*\}$/i;
const DIRECTIVE_ORDER = ['title', 'artist', 'key', 'tempo', 'capo', 'x_youtube', 'x_tags', 'x_language'];

export function extractDirective(content: string, name: string): string | null {
  const re = new RegExp(`^\\{${name}:\\s*([^}]*)\\}`, 'im');
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

export function updateDirective(content: string, name: string, value: string | null): string {
  const re = new RegExp(`^\\{${name}:.*\\}[ \\t]*$`, 'im');
  if (!value || !value.trim()) {
    // Remove directive line (and trailing newline if present)
    return content.replace(new RegExp(`^\\{${name}:.*\\}[ \\t]*\\n?`, 'im'), '');
  }
  const newLine = `{${name}: ${value.trim()}}`;
  if (re.test(content)) {
    return content.replace(re, newLine);
  }
  // Insert at correct position among directives at top of file
  const lines = content.split('\n');
  const targetIdx = DIRECTIVE_ORDER.indexOf(name);
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    const dm = lines[i].match(DIRECTIVE_RE);
    if (dm) {
      const existingIdx = DIRECTIVE_ORDER.indexOf(dm[1].toLowerCase());
      if (existingIdx < targetIdx || (existingIdx === -1 && targetIdx === -1)) {
        insertAt = i + 1;
      }
    } else if (DIRECTIVE_LINE_RE.test(lines[i])) {
      insertAt = i + 1;
    } else {
      break;
    }
  }
  lines.splice(insertAt, 0, newLine);
  return lines.join('\n');
}

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
  // Separate directive lines from body so x_ directives survive UG parser conversion
  const lines = content.split('\n');
  const directiveLines: string[] = [];
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (DIRECTIVE_LINE_RE.test(lines[i].trim())) {
      directiveLines.push(lines[i]);
      bodyStart = i + 1;
    } else if (lines[i].trim() === '') {
      bodyStart = i + 1;
    } else {
      break;
    }
  }
  const body = lines.slice(bodyStart).join('\n');
  const song = parseSongAuto(body || content);
  if (!song) return content;
  try {
    let result = new ChordSheetJS.ChordProFormatter({ normalizeChords: false } as Record<string, unknown>).format(song);
    // Remove any directives the formatter produced that we already have in directiveLines
    if (directiveLines.length > 0) {
      const existingNames = new Set(directiveLines.map(l => {
        const m = l.match(DIRECTIVE_RE);
        return m ? m[1].toLowerCase() : '';
      }).filter(Boolean));
      const resultLines = result.split('\n');
      const filtered = resultLines.filter(l => {
        const m = l.match(DIRECTIVE_RE);
        return !(m && existingNames.has(m[1].toLowerCase()));
      });
      result = [...directiveLines, ...filtered].join('\n');
    }
    return result;
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

class ResponsiveHtmlFormatter {
  format(song: ChordSheetJS.Song): string {
    return song.paragraphs.map(p => this.renderParagraph(p)).join('');
  }

  private renderParagraph(p: ChordSheetJS.Paragraph): string {
    const SECTION_RE = /^\[?(Verse|Chorus|Bridge|Intro|Outro|Interlude|Pre-?Chorus|Ending|Tag|Coda|Break|Solo|Instrumental|Refrain)\s*\d*:?\]?$/i;
    
    let content = p.lines.map(l => this.renderLine(l)).join('');
    let detectedType = p.type;

    // Promote paragraph type if the first line is a label (helps CSS match)
    if (detectedType === 'none' || detectedType === 'indeterminate') {
      const firstLine = p.lines[0];
      const firstItem = firstLine?.items[0];
      if (firstItem && 'lyrics' in firstItem) {
        const lyrics = (firstItem.lyrics || '').trim();
        const chords = (firstItem.chords || '').trim();
        // Check lyrics for label or chords for bracketed label
        const potentialLabel = lyrics || chords;
        if (!lyrics !== !chords && SECTION_RE.test(potentialLabel)) {
          detectedType = potentialLabel.replace(/[[\]:]/g, '').split(/\s+/)[0].toLowerCase().replace('-', '');
        }
      }
    }

    // Only add automatic label if:
    // 1. Type is known (not none/indeterminate)
    // 2. We haven't already rendered a label badge in this paragraph
    // 3. The paragraph actually has content (prevents empty "Indeterminate" badges for metadata)
    const hasRenderableContent = p.lines.some(l => 
      l.items.some(it => ('lyrics' in it && it.lyrics?.trim()) || ('chords' in it && it.chords?.trim()))
    );

    if (detectedType !== 'none' && detectedType !== 'indeterminate' && 
        !content.includes('class="label"') && hasRenderableContent) {
      const typeLabel = detectedType.charAt(0).toUpperCase() + detectedType.slice(1);
      content = `<div class="row"><h3 class="label">${escHtml(typeLabel)}</h3></div>` + content;
    }

    return `<div class="paragraph ${detectedType}">${content}</div>`;
  }

  private renderLine(l: ChordSheetJS.Line): string {
    const SECTION_RE = /^\[?(Verse|Chorus|Bridge|Intro|Outro|Interlude|Pre-?Chorus|Ending|Tag|Coda|Break|Solo|Instrumental|Refrain)\s*\d*:?\]?$/i;

    if (l.type === 'comment') {
      const firstItem = l.items[0];
      const content = (firstItem && 'content' in firstItem ? (firstItem as ChordSheetJS.Comment).content : 
                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
                     (firstItem && 'lyrics' in firstItem ? (firstItem as any).lyrics : '')) || '';
      
      if (SECTION_RE.test(content.trim())) {
        const cleanLabel = content.trim().replace(/[[\]:]/g, '');
        return `<div class="row"><h3 class="label">${escHtml(cleanLabel)}</h3></div>`;
      }
      return `<div class="comment">${escHtml(content)}</div>`;
    }

    // Check for section labels on normal lyric lines or bracketed chords
    const firstItem = l.items[0];
    if (firstItem && 'lyrics' in firstItem) {
      const it = firstItem as ChordSheetJS.ChordLyricsPair;
      const lyrics = (it.lyrics || '').trim();
      const chords = (it.chords || '').trim();
      // Only one of them should be present for a pure label line
      if (!lyrics !== !chords && SECTION_RE.test(lyrics || chords)) {
        const cleanLabel = (lyrics || chords).replace(/[[\]:]/g, '');
        return `<div class="row"><h3 class="label">${escHtml(cleanLabel)}</h3></div>`;
      }
    }

    const content = l.items.map(it => this.renderItem(it as ChordSheetJS.ChordLyricsPair)).join('');
    return `<div class="row">${content}</div>`;
  }

  private renderItem(it: ChordSheetJS.ChordLyricsPair): string {
    const lyrics = it.lyrics || '';

    // If no lyrics, just render the chord column
    if (!lyrics) {
      const chords = it.chords ? `<span class="chord">${escHtml(it.chords)}</span>` : '<span class="chord"></span>';
      return `<span class="column">${chords}<span class="lyrics"></span></span>`;
    }

    // Split lyrics by whitespace chunks. We treat any sequence of spaces as one unit
    // so the browser doesn't wrap "inside" the spacing between chords.
    const chunks = lyrics.split(/(\s+)/).filter((chunk: string) => chunk !== '');
    let chordPlaced = false;

    return chunks.map((chunk: string) => {
      const isSpace = /\s+/.test(chunk);
      
      // If we've already placed the chord for this item, and this is a space,
      // output it as raw text. To prevent ugly wrapping between multiple spaces,
      // we ensure this raw text chunk is an unbreakable unit.
      if (isSpace && chordPlaced) {
        return escHtml(chunk);
      }

      // If we haven't placed the chord yet, or if it's a word, wrap in a column.
      // The chord is only attached to the VERY FIRST chunk (word or space).
      const rawChord = chordPlaced ? '' : (it.chords || '');
      const currentChord = normalizeChord(rawChord);
      chordPlaced = true;
      
      const chords = `<span class="chord">${escHtml(currentChord)}</span>`;
      const lyricText = escHtml(chunk);
      return `<span class="column">${chords}<span class="lyrics">${lyricText}</span></span>`;
    }).join('');
  }
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

    const html = new ResponsiveHtmlFormatter().format(transposed);
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
    if (key) return normalizeKey(key);
    // Fallback: derive key from first chord
    for (const p of transposed.paragraphs) {
      for (const line of p.lines) {
        for (const item of line.items) {
          const chords = (item as { chords?: string }).chords;
          if (chords && chords.trim()) {
            const m = chords.trim().match(/^([A-G][b#]?m?)/);
            if (m) return normalizeKey(m[1]);
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

    const available = window.innerHeight - wrap.getBoundingClientRect().top - 24; // 24px safety margin
    return output.scrollHeight <= available;
  };

  // Try single-column first, shrinking font
  for (let offset = 0; offset >= -3; offset--) {
    if (tryFit(offset, false)) {
      return { fontSize: clampFontSize(offset), twoCol: false };
    }
  }

  // Fall back to 2-column only if screen is wide enough (tablet/desktop)
  if (window.innerWidth >= 640) {
    for (let offset = 0; offset >= -3; offset--) {
      if (tryFit(offset, true)) {
        return { fontSize: clampFontSize(offset), twoCol: true };
      }
    }
  }

  // Restore original state before returning fallback
  if (wasTwoCol) wrap.classList.add('two-col');
  else wrap.classList.remove('two-col');
  if (prevScale) wrap.style.setProperty('--font-scale', prevScale);
  else wrap.style.removeProperty('--font-scale');

  // If nothing fits, use smallest font and 2-col (if wide) or 1-col (if narrow)
  const finalTwoCol = window.innerWidth >= 640;
  return { fontSize: clampFontSize(-3), twoCol: finalTwoCol };
}


export function slEffective<T>(
  entry: SetlistEntry,
  key: 'num' | 'twoCol' | 'font' | 'hideYt',
  globalVal: T
): T {
  if (key === 'font') {
    // Priority: session _font > db font > globalVal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (entry._font !== undefined && entry._font !== null) return entry._font as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (entry.font !== undefined && entry.font !== null) return entry.font as any;
    return globalVal;
  }
  if (key === 'twoCol') {
    // Priority: session _twoCol > db two_col > globalVal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (entry._twoCol !== undefined && entry._twoCol !== null) return entry._twoCol as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (entry.two_col !== undefined && entry.two_col !== null) return (!!entry.two_col) as any;
    return globalVal;
  }
  const keyMap = { num: '_num', hideYt: '_hideYt' } as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ov = (entry as any)[keyMap[key as 'num' | 'hideYt']];
  return (ov != null ? ov : globalVal) as T;
}
