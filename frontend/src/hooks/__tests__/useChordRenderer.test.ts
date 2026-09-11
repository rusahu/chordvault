import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useChordRenderer } from '../useChordRenderer';

const CONTENT = '{key: G}\n[G]Amazing [C]grace how [D]sweet';

// The song view's target key is POSTed by AddToSetlistModal, which the API
// validates at +/-12 semitones, so the derived transpose must stay canonical.
describe('useChordRenderer transpose', () => {
  it('keeps repeated key picks inside the persistable range', () => {
    // A monotonic whole-tone walk: every pick is +2, so an un-normalized
    // accumulator crosses +12 on the seventh. Alternating two keys would not.
    const WALK = ['A', 'B', 'C#', 'Eb', 'F', 'G', 'A', 'B', 'C#', 'Eb', 'F', 'G'];
    const { result } = renderHook(() => useChordRenderer(CONTENT));
    for (const target of WALK) {
      act(() => { result.current.pickKey(target); });
      expect(result.current.transpose).toBeGreaterThanOrEqual(-12);
      expect(result.current.transpose).toBeLessThanOrEqual(12);
      expect(result.current.currentKey).toBe(target);
    }
  });

  it('steps the key without accumulating a delta', () => {
    const { result } = renderHook(() => useChordRenderer('{key: G}\n[G]a [C]b'));
    act(() => { result.current.stepCurrentKey(1); });
    expect(result.current.targetKey).toBe('G#');
    expect(result.current.currentKey).toBe('G#');
    act(() => { result.current.stepCurrentKey(-1); });
    expect(result.current.targetKey).toBe('G');
  });
});
