const { ALL_KEYS, ALL_KEYS_MINOR, ENHARMONIC_MAP, normalizeKey } = require('../shared/music-keys.mjs');
const CANONICAL_KEYS = [...ALL_KEYS, ...ALL_KEYS_MINOR, 'H', 'Hm'];

module.exports = { ALL_KEYS, ALL_KEYS_MINOR, ENHARMONIC_MAP, normalizeKey, CANONICAL_KEYS };
