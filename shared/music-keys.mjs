export const ALL_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
export const ALL_KEYS_MINOR = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

export const ENHARMONIC_MAP = {
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
  'E#': 'F',
  'E#m': 'Fm',
  'B#': 'C',
  'B#m': 'Cm',
  'Dbm': 'C#m',
  'Gbm': 'F#m',
  'Abm': 'G#m',
  'A#m': 'Bbm',
  'D#m': 'Ebm',
};

export function normalizeKey(k) {
  return ENHARMONIC_MAP[k] || k;
}
