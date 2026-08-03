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

// Key.distance returns an unsigned 0-11 semitone distance and resolves enharmonics
// and minor keys itself, so no normalizeKey pre-pass is needed. It throws on
// unparseable input. The wrap to a signed delta is ours, so picking a key a fifth
// down stores -5 rather than 7.
export function getTransposeDelta(fromKey: string, toKey: string): number {
  try {
    const delta = ChordSheetJS.Key.distance(fromKey, toKey);
    return delta > 6 ? delta - 12 : delta;
  } catch {
    return 0;
  }
}
