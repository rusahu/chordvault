import { describe, it, expect } from 'vitest';
import { fileToSong, chunkSongs } from '../import';

describe('fileToSong', () => {
  it('injects {title:} from filename when absent', () => {
    expect(fileToSong('Amazing Grace.cho', '[G]a').content).toBe('{title: Amazing Grace}\n[G]a');
  });
  it('strips only the last extension', () => {
    expect(fileToSong('My.Song.v2.txt', '[G]a').content).toBe('{title: My.Song.v2}\n[G]a');
  });
  it('preserves existing {title:} untouched', () => {
    expect(fileToSong('whatever.txt', '{title: Real}\n[G]a').content).toBe('{title: Real}\n[G]a');
  });
  it('handles a filename with no extension', () => {
    expect(fileToSong('NoExt', '[G]a').content).toBe('{title: NoExt}\n[G]a');
  });
});

describe('chunkSongs', () => {
  it('splits by song count (>500)', () => {
    const songs = Array.from({ length: 501 }, () => ({ content: 'x' }));
    const chunks = chunkSongs(songs);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(500);
    expect(chunks[1].length).toBe(1);
  });
  it('splits by cumulative bytes', () => {
    const big = { content: 'x'.repeat(5_000_000) };
    const chunks = chunkSongs([big, big, big]);
    expect(chunks.length).toBe(2); // 2 fit (~10MB), 3rd overflows 12MB
  });
  it('returns empty array for empty input', () => {
    expect(chunkSongs([])).toEqual([]);
  });
  it('keeps a single oversized song in its own batch', () => {
    const chunks = chunkSongs([{ content: 'x'.repeat(13_000_000) }]);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(1);
  });
  it('counts real UTF-8 bytes, not UTF-16 code units, for CJK content', () => {
    // 'あ' is 1 UTF-16 code unit but 3 UTF-8 bytes. .length sum (9M) would fit
    // in one batch under the old bug; actual byte size (~13.5M each) forces separate batches.
    const cjk = { content: 'あ'.repeat(4_500_000) };
    const chunks = chunkSongs([cjk, cjk]);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(1);
    expect(chunks[1].length).toBe(1);
  });
});
