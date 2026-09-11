import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useChordRenderer } from '../useChordRenderer';

const CONTENT = '{key: G}\n[G]Amazing [C]grace how [D]sweet';

// The song view's transpose is POSTed by AddToSetlistModal, which the API
// validates at +/-12, so it must stay canonical however the user gets there.
describe('useChordRenderer transpose', () => {
  it('keeps repeated arrow presses inside the persistable range', () => {
    const { result } = renderHook(() => useChordRenderer(CONTENT));
    for (let i = 0; i < 20; i++) {
      act(() => { result.current.doTranspose(1); });
      expect(result.current.transpose).toBeGreaterThanOrEqual(-12);
      expect(result.current.transpose).toBeLessThanOrEqual(12);
    }
  });

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

  it('resets to zero', () => {
    const { result } = renderHook(() => useChordRenderer(CONTENT));
    act(() => { result.current.doTranspose(5); });
    act(() => { result.current.resetTranspose(); });
    expect(result.current.transpose).toBe(0);
  });
});
