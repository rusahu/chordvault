import * as ChordSheetJS from 'chordsheetjs';

export const ALL_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
export const ALL_KEYS_MINOR = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

export const ENHARMONIC_MAP: Record<string, string> = {
  // Prefer sharps generally, but Bb and Eb are exceptions
  'Db': 'C#',
  'Gb': 'F#',
  'Ab': 'G#',
  'A#': 'Bb',
  'D#': 'Eb',
  'Cb': 'B',
  'Cbm': 'Bm',
  // Fb only became reachable once getTransposeDelta went signed in v1.22.2:
  // descending a semitone spells flat-ward. Both entries are required — the
  // root regex swallows the 'm' of maj7 and looks up 'Fbm'.
  'Fb': 'E',
  'Fbm': 'Em',
  'Dbm': 'C#m',
  'Gbm': 'F#m',
  'Abm': 'G#m',
  'A#m': 'Bbm',
  'D#m': 'Ebm',
};

export function normalizeKey(k: string): string {
  return ENHARMONIC_MAP[k] || k;
}

export function normalizeChord(chord: string): string {
  if (!chord) return chord;
  return chord.replace(/[A-G][b#]?m?/g, (m) => ENHARMONIC_MAP[m] || m);
}

/**
 * Collapses a semitone shift onto the canonical -5..+6 window.
 *
 * Transpose is only meaningful modulo 12 (chord symbols carry no octave).
 * `getTransposeDelta` computes a single shift fresh at render time from a
 * `target_key`, but `Key.distance` only ever counts upward, so this keeps
 * that shift the shortest signed distance between the two keys.
 *
 * Twelve distinct values, not thirteen: -6 and +6 name the same key, so the
 * tritone is always canonicalised upward as +6.
 */
function normalizeTranspose(semitones: number): number {
  const wrapped = ((semitones % 12) + 12) % 12;
  return wrapped > 6 ? wrapped - 12 : wrapped;
}

/** Shortest signed distance between two keys. Negative when down is nearer. */
export function getTransposeDelta(fromKey: string, toKey: string): number {
  try {
    return normalizeTranspose(ChordSheetJS.Key.distance(fromKey, toKey));
  } catch {
    return 0;
  }
}

/**
 * Returns the key one semitone above or below `key`, preserving major/minor.
 *
 * Replaces the old accumulate-a-delta arrow handlers: stepping between key
 * names cannot drift out of range the way a running total could.
 */
export function stepKey(key: string, direction: 1 | -1): string {
  const normalized = normalizeKey(key);
  const table = normalized.endsWith('m') ? ALL_KEYS_MINOR : ALL_KEYS;
  const idx = table.indexOf(normalized);
  if (idx !== -1) return table[(idx + direction + table.length) % table.length];

  // Keys the picker's table doesn't hold still have to step, or their sharp and
  // flat buttons are dead forever: German 'H'/'Hm', and spellings like 'B#'
  // that ENHARMONIC_MAP doesn't cover. ChordSheetJS knows them, and one step
  // lands back in the table. Its answer is used only when it IS a table key, so
  // the button can never write a name the API would reject.
  try {
    const parsed = ChordSheetJS.Key.parse(normalized);
    if (parsed) {
      const stepped = normalizeKey(String(parsed.transpose(direction).normalize()));
      if (ALL_KEYS.includes(stepped) || ALL_KEYS_MINOR.includes(stepped)) return stepped;
    }
  } catch { /* not a key this can step */ }
  return key;
}
