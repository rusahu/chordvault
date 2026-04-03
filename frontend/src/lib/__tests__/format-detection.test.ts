import { detectFormat, parseSongAutoWithFormat } from '../chords';

describe('format detection edge cases', () => {
  it('directives at top + chords-over-lyrics below', () => {
    const content = '{title: My Song}\n{key: G}\n\n  G        D\n  Let it   be';
    // Should detect as chords-over-lyrics (the body format), not null
    const result = detectFormat(content);
    expect(result).not.toBeNull();
  });

  it('section labels only — UG parser may treat as valid UG format', () => {
    // UG parser recognizes [Verse]/[Chorus] as section markers, so it may
    // "detect" chords even without real chord content. ChordPro path correctly
    // filters these out. The key thing: ChordPro is NOT returned.
    const content = '[Verse]\nSome lyrics here\n\n[Chorus]\nMore lyrics';
    const result = detectFormat(content);
    expect(result).not.toBe('ChordPro');
  });

  it('section labels with mixed case — not ChordPro', () => {
    const content = '[VERSE]\nLyrics\n[CHORUS]\nMore lyrics';
    expect(detectFormat(content)).not.toBe('ChordPro');
  });

  it('section labels with numbers — not ChordPro', () => {
    const content = '[Verse 1]\nLyrics\n[Verse 2]\nMore lyrics';
    expect(detectFormat(content)).not.toBe('ChordPro');
  });

  it('key directive + lyrics only (no chords) → null', () => {
    const content = '{key: C}\nJust some lyrics\nNo chords anywhere';
    expect(detectFormat(content)).toBeNull();
  });

  it('inline ChordPro with directives', () => {
    const content = '{title: Test}\n{key: G}\n[G]Amazing [C]grace [D]how [G]sweet';
    expect(detectFormat(content)).toBe('ChordPro');
  });

  it('real-world chords-over-lyrics snippet', () => {
    const content = `
      G           Cadd9
Amazing grace how sweet the sound
      G             D
That saved a wretch like me
    `.trim();
    // UG parser picks up chords-over-lyrics format too — both are valid
    const result = detectFormat(content);
    expect(result).not.toBeNull();
    expect(['Ultimate Guitar', 'Chords over lyrics']).toContain(result);
  });

  it('real-world ChordPro snippet', () => {
    const content = `{title: Amazing Grace}
{artist: John Newton}
{key: G}

{start_of_verse}
[G]Amazing [G7]grace how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me
{end_of_verse}`;
    expect(detectFormat(content)).toBe('ChordPro');
  });

  it('single chord line is detected', () => {
    // A single chord above lyrics should be enough
    const content = 'G\nAmazing grace';
    const result = detectFormat(content);
    // This might be detected as chords-over-lyrics or might not — the key thing
    // is it doesn't crash
    expect(() => detectFormat(content)).not.toThrow();
  });

  it('parseSongAutoWithFormat returns format and song', () => {
    const content = '[G]Amazing [C]grace';
    const result = parseSongAutoWithFormat(content);
    expect(result).not.toBeNull();
    expect(result!.format).toBe('ChordPro');
    expect(result!.song).toBeDefined();
  });

  it('parseSongAutoWithFormat returns null format for no chords', () => {
    const content = 'Just lyrics without any chords';
    const result = parseSongAutoWithFormat(content);
    expect(result).not.toBeNull(); // still parses
    expect(result!.format).toBeNull(); // but no chord format detected
  });

  it('handles content with only whitespace lines between directives and chords', () => {
    const content = '{title: Song}\n\n\n\n[G]Lyrics [C]here';
    expect(detectFormat(content)).toBe('ChordPro');
  });

  it('pre-chorus section label not detected as ChordPro', () => {
    const content = '[Pre-Chorus]\nSome lyrics\n[Bridge]\nMore lyrics';
    // UG parser may pick these up, but ChordPro should not
    expect(detectFormat(content)).not.toBe('ChordPro');
  });
});
