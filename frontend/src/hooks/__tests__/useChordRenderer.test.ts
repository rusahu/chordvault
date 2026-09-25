import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useChordRenderer } from '../useChordRenderer';

const CONTENT = '{key: G}\n[G]Amazing [C]grace how [D]sweet';

// The shift is derived fresh from the song's own key on every pick. The old
// model accumulated it, so a walk like the one below drifted further from the
// truth with each step; the assertion that matters is that the song actually
// sounds in the key that was picked, however many picks came before.
// (getTransposeDelta's own -5..+6 window is covered in keys.test.ts.)
describe('useChordRenderer transpose', () => {
  it('sounds in every picked key across a long monotonic walk', () => {
    // A monotonic whole-tone walk: every pick is +2, so an un-normalized
    // accumulator crosses +12 on the seventh. Alternating two keys would not.
    const WALK = ['A', 'B', 'C#', 'Eb', 'F', 'G', 'A', 'B', 'C#', 'Eb', 'F', 'G'];
    const { result } = renderHook(() => useChordRenderer(CONTENT));
    for (const target of WALK) {
      act(() => { result.current.pickKey(target); });
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
