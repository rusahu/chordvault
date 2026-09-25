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

// Backend-only: everything the migration's validation gate must accept as a
// derivable key. This is ALL_KEYS/ALL_KEYS_MINOR plus German notation ('H'
// for B natural, 'Hm' for its relative/parallel minor) — Key.distance
// understands 'H' (see CHORDVAULT_CONTEXT.md, "German notation now works"),
// so a song written in it can legitimately land back on 'H' at an
// octave-equivalent shift. Deliberately NOT added to ALL_KEYS/ALL_KEYS_MINOR:
// those drive the frontend key-picker UI, and 'H' has no button there.
const CANONICAL_KEYS = [...ALL_KEYS, ...ALL_KEYS_MINOR, 'H', 'Hm'];

function normalizeKey(k) {
  return ENHARMONIC_MAP[k] || k;
}

module.exports = { ENHARMONIC_MAP, ALL_KEYS, ALL_KEYS_MINOR, CANONICAL_KEYS, normalizeKey };
