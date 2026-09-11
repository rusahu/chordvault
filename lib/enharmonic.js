// Mirror of ENHARMONIC_MAP and the canonical key lists in frontend/src/lib/keys.ts.
// Kept identical by frontend/src/lib/__tests__/enharmonic-parity.test.ts.
const ENHARMONIC_MAP = {
  Db: 'C#',
  Gb: 'F#',
  Ab: 'G#',
  'A#': 'Bb',
  'D#': 'Eb',
  Cb: 'B',
  Cbm: 'Bm',
  Fb: 'E',
  Fbm: 'Em',
  Dbm: 'C#m',
  Gbm: 'F#m',
  Abm: 'G#m',
  'A#m': 'Bbm',
  'D#m': 'Ebm',
};

const ALL_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
const ALL_KEYS_MINOR = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

function normalizeKey(k) {
  return ENHARMONIC_MAP[k] || k;
}

module.exports = { ENHARMONIC_MAP, ALL_KEYS, ALL_KEYS_MINOR, normalizeKey };
