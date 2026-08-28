import { describe, expect, it } from 'vitest';
import { extractSongChords } from '../chords';
import { guitarChordDiagram } from '../guitar-chords';

describe('extractSongChords', () => {
  it('extracts unique ChordPro chords in first-use order', () => {
    expect(extractSongChords('[C]One [Am7]two [C]three\n[Bridge]')).toEqual(['C', 'Am7']);
  });

  it('extracts chords-over-lyrics and Ultimate Guitar content', () => {
    expect(extractSongChords('C     G\nHello world\nAm    F\nAgain')).toEqual(['C', 'G', 'Am', 'F']);
    expect(extractSongChords('[Verse]\nC G Am F\nWords')).toEqual(['C', 'G', 'Am', 'F']);
  });

  it('normalizes, transposes, and preserves exact slash symbols', () => {
    expect(extractSongChords('[Db] [C/E] [Db]')).toEqual(['C#', 'C/E']);
    expect(extractSongChords('[C] [Am]', 2)).toEqual(['D', 'Bm']);
    expect(extractSongChords('[C7sus4] [C6/9]')).toEqual(['C7sus4', 'C6/9']);
  });

  it('returns an empty list for chordless content', () => {
    expect(extractSongChords('Just some lyrics')).toEqual([]);
  });
});

describe('guitarChordDiagram', () => {
  it('adapts open, muted, and fretted strings', () => {
    const chord = guitarChordDiagram('C');
    expect(chord?.position).toBe(1);
    expect(chord?.fingers).toEqual([
      [6, 'x'],
      [5, 3, '3'],
      [4, 2, '2'],
      [3, 0],
      [2, 1, '1'],
      [1, 0],
    ]);
  });

  it('supports minor chords and exact database inversions', () => {
    expect(guitarChordDiagram('Am')).not.toBeNull();
    expect(guitarChordDiagram('C/E')).not.toBeNull();
  });

  it('does not replace unsupported chords with an inaccurate shape', () => {
    expect(guitarChordDiagram('Cadd#11/nope')).toBeNull();
  });

  it.each([
    ['C#', 4],
    ['G#', 4],
    ['Gm', 3],
  ])('uses the familiar full-barre voicing for %s', (symbol, baseFret) => {
    const chord = guitarChordDiagram(symbol);
    expect(chord?.position).toBe(baseFret);
    expect(chord?.barres).toContainEqual({
      fromString: 6,
      toString: 1,
      fret: 1,
      text: '1',
    });
    expect(chord?.fingers).not.toContainEqual(expect.arrayContaining([expect.anything(), 1]));
  });
});
