import { describe, it, expect } from 'vitest';
import { stepKey, getTransposeDelta } from '../keys';
import { getSongKey, renderChordPro } from '../chords';

describe('stepKey', () => {
  it('steps up and down through the major keys', () => {
    expect(stepKey('C', 1)).toBe('C#');
    expect(stepKey('C', -1)).toBe('B');
    expect(stepKey('B', 1)).toBe('C');
    expect(stepKey('G', 1)).toBe('G#');
  });

  it('steps through the minor keys and stays minor', () => {
    expect(stepKey('Am', 1)).toBe('Bbm');
    expect(stepKey('Cm', -1)).toBe('Bm');
    expect(stepKey('Bm', 1)).toBe('Cm');
  });

  it('normalizes an awkward input spelling before stepping', () => {
    expect(stepKey('Gb', 1)).toBe('G');
    expect(stepKey('Db', -1)).toBe('C');
  });

  it('returns the input unchanged when it is not a known key', () => {
    expect(stepKey('', 1)).toBe('');
    expect(stepKey('Chorus', 1)).toBe('Chorus');
  });

  it('never leaves the key set, however many steps are taken', () => {
    let k = 'C';
    for (let i = 0; i < 40; i++) {
      k = stepKey(k, 1);
      expect(k).toMatch(/^[A-G][b#]?$/);
    }
  });
});

describe('a stored target key survives a song key correction', () => {
  // This is the drift bug. With a stored delta, correcting the song's {key:}
  // silently re-keyed every setlist containing it: A became B.
  const before = '{key: G}\n[G]a [C]b [D]c';
  const corrected = '{key: A}\n[A]a [D]b [E]c';

  const renderFor = (content: string, targetKey: string | null) => {
    const semitones = targetKey ? getTransposeDelta(getSongKey(content, 0), targetKey) : 0;
    return getSongKey(content, semitones);
  };

  it('holds the pinned key across the correction', () => {
    expect(renderFor(before, 'A')).toBe('A');
    expect(renderFor(corrected, 'A')).toBe('A');
  });

  it('follows the correction when the entry is as-written', () => {
    expect(renderFor(before, null)).toBe('G');
    expect(renderFor(corrected, null)).toBe('A');
  });

  it('renders without falling back to the error path', () => {
    const semitones = getTransposeDelta(getSongKey(corrected, 0), 'A');
    expect(renderChordPro(corrected, semitones)).toContain('chord-sheet');
  });
});
