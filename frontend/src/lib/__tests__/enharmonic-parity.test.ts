import { describe, it, expect } from 'vitest';
import { ENHARMONIC_MAP as frontendMap, ALL_KEYS as frontendAllKeys, ALL_KEYS_MINOR as frontendAllKeysMinor } from '../keys';
import backend from '../../../../lib/enharmonic.js';

// The backend needs its own copy of the map for the one-time migration backfill.
// Two copies of pure data can drift silently, so assert they are identical.
// Adding an entry to one and not the other fails here immediately.
describe('enharmonic map parity', () => {
  it('backend and frontend maps are identical', () => {
    expect(backend.ENHARMONIC_MAP).toEqual(frontendMap);
  });

  it('backend normalizeKey matches the map, including the Fb and Cb entries', () => {
    expect(backend.normalizeKey('Cb')).toBe('B');
    expect(backend.normalizeKey('Cbm')).toBe('Bm');
    expect(backend.normalizeKey('Fb')).toBe('E');
    expect(backend.normalizeKey('Fbm')).toBe('Em');
    expect(backend.normalizeKey('Gb')).toBe('F#');
    expect(backend.normalizeKey('G')).toBe('G');
  });

  // The backend's migration gate (lib/songKey.js) validates its output against
  // these lists to reject non-canonical spellings before they can reach an
  // irreversible column drop. A drifted copy would silently widen or narrow
  // that gate, so it's held to the same parity guarantee as the map above.
  it('backend and frontend canonical key lists are identical', () => {
    expect(backend.ALL_KEYS).toEqual(frontendAllKeys);
    expect(backend.ALL_KEYS_MINOR).toEqual(frontendAllKeysMinor);
  });
});
