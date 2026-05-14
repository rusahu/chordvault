export const ALL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const ALL_KEYS_MINOR = ['Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];

export const ENHARMONIC_MAP: Record<string, string> = {
  // Force all flats to sharps
  'Db': 'C#',
  'Eb': 'D#',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#',
  'Dbm': 'C#m',
  'Ebm': 'D#m',
  'Gbm': 'F#m',
  'Abm': 'G#m',
  'Bbm': 'A#m',
};

export function normalizeKey(k: string): string {
  return ENHARMONIC_MAP[k] || k;
}

export function normalizeChord(chord: string): string {
  if (!chord) return chord;
  return chord.replace(/[A-G][b#]?m?/g, (m) => ENHARMONIC_MAP[m] || m);
}
