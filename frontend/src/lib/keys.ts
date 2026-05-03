export const ALL_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
export const ALL_KEYS_MINOR = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

export const ENHARMONIC_MAP: Record<string, string> = {
  // Prefer sharps for these
  'Db': 'C#', 'Gb': 'F#', 'Ab': 'G#', 'A#': 'Bb', 'D#': 'Eb',
  'Dbm': 'C#m', 'Gbm': 'F#m', 'Abm': 'G#m', 'A#m': 'Bbm', 'D#m': 'Ebm',
};

export function normalizeKey(k: string): string {
  return ENHARMONIC_MAP[k] || k;
}
