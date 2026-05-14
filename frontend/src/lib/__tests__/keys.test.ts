import { describe, it, expect } from 'vitest';
import { normalizeKey, normalizeChord } from '../keys';

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

    it('handles complex suffixes', () => {
      expect(normalizeChord('Abmaj7(#11)')).toBe('G#maj7(#11)');
    });
  });
});
