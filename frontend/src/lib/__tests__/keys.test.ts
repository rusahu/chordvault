import { describe, it, expect } from 'vitest';
import { normalizeKey, normalizeChord } from '../keys';

describe('keys library', () => {
  describe('normalizeKey', () => {
    it('forces flats to sharps for major keys', () => {
      expect(normalizeKey('Db')).toBe('C#');
      expect(normalizeKey('Eb')).toBe('D#');
      expect(normalizeKey('Gb')).toBe('F#');
      expect(normalizeKey('Ab')).toBe('G#');
      expect(normalizeKey('Bb')).toBe('A#');
    });

    it('forces flats to sharps for minor keys', () => {
      expect(normalizeKey('Dbm')).toBe('C#m');
      expect(normalizeKey('Ebm')).toBe('D#m');
      expect(normalizeKey('Gbm')).toBe('F#m');
      expect(normalizeKey('Abm')).toBe('G#m');
      expect(normalizeKey('Bbm')).toBe('A#m');
    });

    it('leaves already normalized keys alone', () => {
      expect(normalizeKey('C#')).toBe('C#');
      expect(normalizeKey('D#')).toBe('D#');
      expect(normalizeKey('F#')).toBe('F#');
      expect(normalizeKey('G#')).toBe('G#');
      expect(normalizeKey('A#')).toBe('A#');
      expect(normalizeKey('C')).toBe('C');
    });
  });

  describe('normalizeChord', () => {
    it('normalizes the root of a chord', () => {
      expect(normalizeChord('Abm7')).toBe('G#m7');
      expect(normalizeChord('Dbadd9')).toBe('C#add9');
      expect(normalizeChord('Eb7')).toBe('D#7');
      expect(normalizeChord('Bbsus4')).toBe('A#sus4');
    });

    it('normalizes the bass of a slash chord', () => {
      expect(normalizeChord('E/Ab')).toBe('E/G#');
      expect(normalizeChord('G#m/Gb')).toBe('G#m/F#');
      expect(normalizeChord('C/Eb')).toBe('C/D#');
      expect(normalizeChord('F/Bb')).toBe('F/A#');
    });

    it('normalizes both root and bass', () => {
      expect(normalizeChord('Abm7/Gb')).toBe('G#m7/F#');
      expect(normalizeChord('Bb/Eb')).toBe('A#/D#');
    });

    it('handles numeric suffixes like 7', () => {
      expect(normalizeChord('Ab7')).toBe('G#7');
    });

    it('handles complex suffixes', () => {
      expect(normalizeChord('Abmaj7(#11)')).toBe('G#maj7(#11)');
    });
  });
});
