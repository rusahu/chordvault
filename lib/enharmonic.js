// Mirror of ENHARMONIC_MAP in frontend/src/lib/keys.ts.
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

function normalizeKey(k) {
  return ENHARMONIC_MAP[k] || k;
}

module.exports = { ENHARMONIC_MAP, normalizeKey };
