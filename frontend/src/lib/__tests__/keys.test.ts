import { describe, it, expect } from 'vitest';
import { normalizeKey, normalizeChord, getTransposeDelta } from '../keys';

describe('keys library', () => {
  describe('normalizeKey', () => {
    it('prefers G# over Ab', () => {
      expect(normalizeKey('Ab')).toBe('G#');
      expect(normalizeKey('Abm')).toBe('G#m');
    });

    it('prefers C# over Db', () => {
      expect(normalizeKey('Db')).toBe('C#');
      expect(normalizeKey('Dbm')).toBe('C#m');
    });

    it('prefers F# over Gb', () => {
      expect(normalizeKey('Gb')).toBe('F#');
      expect(normalizeKey('Gbm')).toBe('F#m');
    });

    it('prefers Bb over A# (exception)', () => {
      expect(normalizeKey('A#')).toBe('Bb');
      expect(normalizeKey('A#m')).toBe('Bbm');
    });

    it('prefers Eb over D# (exception)', () => {
      expect(normalizeKey('D#')).toBe('Eb');
      expect(normalizeKey('D#m')).toBe('Ebm');
    });

    it('leaves already normalized keys alone', () => {
      expect(normalizeKey('G#')).toBe('G#');
      expect(normalizeKey('Bb')).toBe('Bb');
      expect(normalizeKey('C')).toBe('C');
    });
  });

  describe('normalizeChord', () => {
    it('normalizes the root of a chord', () => {
      expect(normalizeChord('Abm7')).toBe('G#m7');
      expect(normalizeChord('Dbadd9')).toBe('C#add9');
    });

    it('normalizes the bass of a slash chord', () => {
      expect(normalizeChord('E/Ab')).toBe('E/G#');
      expect(normalizeChord('G#m/Gb')).toBe('G#m/F#');
    });

    it('normalizes both root and bass', () => {
      expect(normalizeChord('Abm7/Gb')).toBe('G#m7/F#');
    });

    it('handles exceptions Bb and Eb', () => {
      expect(normalizeChord('A#')).toBe('Bb');
      expect(normalizeChord('D#sus4')).toBe('Ebsus4');
    });

    it('handles numeric suffixes like 7', () => {
      expect(normalizeChord('Ab7')).toBe('G#7');
    });

    it('handles complex suffixes', () => {
      expect(normalizeChord('Abmaj7(#11)')).toBe('G#maj7(#11)');
    });
  });

  describe('getTransposeDelta', () => {
    it('calculates 0 for identical keys', () => {
      expect(getTransposeDelta('C', 'C')).toBe(0);
      expect(getTransposeDelta('C#', 'Db')).toBe(0);
    });

    it('calculates shortest positive distance', () => {
      expect(getTransposeDelta('C', 'D')).toBe(2);
      expect(getTransposeDelta('C', 'F#')).toBe(6);
    });

    it('wraps distances greater than 6 to negative', () => {
      expect(getTransposeDelta('C', 'G')).toBe(-5);
      expect(getTransposeDelta('C', 'B')).toBe(-1);
    });

    it('wraps distances less than -6 to positive', () => {
      expect(getTransposeDelta('B', 'C')).toBe(1);
      expect(getTransposeDelta('G', 'C')).toBe(5);
    });

    it('handles minor keys correctly', () => {
      expect(getTransposeDelta('Am', 'Dm')).toBe(5);
      expect(getTransposeDelta('Cm', 'Gm')).toBe(-5);
    });

    it('resolves the tritone upward in both directions', () => {
      expect(getTransposeDelta('C', 'F#')).toBe(6);
      expect(getTransposeDelta('F#', 'C')).toBe(6);
    });

    it('resolves enharmonic spellings without the accidental map', () => {
      expect(getTransposeDelta('Db', 'D')).toBe(1);
      expect(getTransposeDelta('Gb', 'G')).toBe(1);
      expect(getTransposeDelta('Ebm', 'Fm')).toBe(2);
    });

    it('reads H as German notation for B natural', () => {
      expect(getTransposeDelta('H', 'C')).toBe(1);
      expect(getTransposeDelta('C', 'H')).toBe(-1);
    });

    it('returns 0 for unparseable keys', () => {
      expect(getTransposeDelta('Chorus', 'C')).toBe(0);
      expect(getTransposeDelta('C', 'Chorus')).toBe(0);
      expect(getTransposeDelta('', 'C')).toBe(0);
      expect(getTransposeDelta('C major', 'C')).toBe(0);
    });
  });
});
