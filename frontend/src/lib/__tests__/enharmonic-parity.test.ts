import { describe, it, expect } from 'vitest';
import { ENHARMONIC_MAP as frontendMap } from '../keys';
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
});
