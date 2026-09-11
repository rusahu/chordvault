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
 * Transpose is only meaningful modulo 12 (chord symbols carry no octave), but
 * it is accumulated across key changes and persisted in `setlist_songs.transpose`,
 * which the API bounds to +/-12. Without this, repeated key picks drift out of
 * that range while still rendering a perfectly ordinary key.
 *
 * Twelve distinct values, not thirteen: -6 and +6 name the same key, so the
 * tritone is always canonicalised upward as +6.
 */
export function normalizeTranspose(semitones: number): number {
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
