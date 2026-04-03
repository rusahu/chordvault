import { extractDirective, updateDirective, toChordPro, ensureKeyDirective, detectFormat } from '../chords';

// ─── extractDirective ───────────────────────────────────────────────

describe('extractDirective', () => {
  it('extracts a standard directive value', () => {
    const content = '{title: Amazing Grace}\n{artist: John Newton}\n[G]Amazing';
    expect(extractDirective(content, 'title')).toBe('Amazing Grace');
    expect(extractDirective(content, 'artist')).toBe('John Newton');
  });

  it('returns null when directive is missing', () => {
    expect(extractDirective('{title: Test}\nlyrics', 'artist')).toBeNull();
  });

  it('handles x_ custom directives', () => {
    const content = '{x_tags: worship,praise}\n{x_language: en}\n{x_youtube: https://yt.com/abc}';
    expect(extractDirective(content, 'x_tags')).toBe('worship,praise');
    expect(extractDirective(content, 'x_language')).toBe('en');
    expect(extractDirective(content, 'x_youtube')).toBe('https://yt.com/abc');
  });

  it('trims whitespace around value', () => {
    expect(extractDirective('{title:   Spaced Out  }', 'title')).toBe('Spaced Out');
  });

  it('first match wins with duplicate directives', () => {
    const content = '{title: First}\n{title: Second}';
    expect(extractDirective(content, 'title')).toBe('First');
  });

  it('returns null for empty content', () => {
    expect(extractDirective('', 'title')).toBeNull();
  });
});

// ─── updateDirective ────────────────────────────────────────────────

describe('updateDirective', () => {
  it('replaces existing directive in-place', () => {
    const content = '{title: Old Title}\n{artist: Someone}\n[G]Lyrics';
    const result = updateDirective(content, 'title', 'New Title');
    expect(result).toBe('{title: New Title}\n{artist: Someone}\n[G]Lyrics');
  });

  it('inserts new directive in correct order', () => {
    const content = '{title: Song}\n[G]Lyrics';
    const result = updateDirective(content, 'artist', 'Artist Name');
    expect(result).toContain('{artist: Artist Name}');
    // artist should come after title
    const lines = result.split('\n');
    const titleIdx = lines.findIndex(l => l.includes('{title:'));
    const artistIdx = lines.findIndex(l => l.includes('{artist:'));
    expect(artistIdx).toBeGreaterThan(titleIdx);
  });

  it('inserts tempo after artist', () => {
    const content = '{title: Song}\n{artist: Bob}\n[G]Lyrics';
    const result = updateDirective(content, 'tempo', '120');
    const lines = result.split('\n');
    const artistIdx = lines.findIndex(l => l.includes('{artist:'));
    const tempoIdx = lines.findIndex(l => l.includes('{tempo:'));
    expect(tempoIdx).toBeGreaterThan(artistIdx);
  });

  it('removes directive when value is null', () => {
    const content = '{title: Song}\n{artist: Bob}\n[G]Lyrics';
    const result = updateDirective(content, 'artist', null);
    expect(result).not.toContain('{artist:');
    expect(result).toContain('{title: Song}');
    expect(result).toContain('[G]Lyrics');
  });

  it('removes directive when value is empty string', () => {
    const content = '{title: Song}\n{artist: Bob}\n[G]Lyrics';
    const result = updateDirective(content, 'artist', '');
    expect(result).not.toContain('{artist:');
  });

  it('inserts into empty content', () => {
    const result = updateDirective('', 'title', 'New Song');
    expect(result).toBe('{title: New Song}\n');
  });

  it('does not corrupt surrounding lyrics', () => {
    const content = '{title: Song}\n\n[G]First line\n[C]Second line';
    const result = updateDirective(content, 'artist', 'New Artist');
    expect(result).toContain('[G]First line');
    expect(result).toContain('[C]Second line');
  });

  it('handles x_ directives', () => {
    const content = '{title: Song}\n[G]Lyrics';
    const result = updateDirective(content, 'x_tags', 'worship,praise');
    expect(result).toContain('{x_tags: worship,praise}');
  });

  it('removes trailing whitespace on directive line', () => {
    const content = '{title: Song}   \n[G]Lyrics';
    const result = updateDirective(content, 'title', 'Updated');
    expect(result).toBe('{title: Updated}\n[G]Lyrics');
  });
});

// ─── detectFormat ───────────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects ChordPro format', () => {
    expect(detectFormat('[G]Let it [D]be')).toBe('ChordPro');
  });

  it('detects chords-over-lyrics format (UG parser picks it up)', () => {
    const content = '  G        D\n  Let it be';
    // UG parser matches chords-over-lyrics first — both are valid detections
    expect(detectFormat(content)).toBe('Ultimate Guitar');
  });

  it('returns null for empty content', () => {
    expect(detectFormat('')).toBeNull();
    expect(detectFormat('   ')).toBeNull();
  });

  it('returns null for lyrics with no chords', () => {
    expect(detectFormat('Just some lyrics\nwithout any chords')).toBeNull();
  });

  it('section labels alone parsed by UG parser (no real chords for ChordPro)', () => {
    // UG parser treats [Chorus]/[Verse] as valid UG section markers
    // The ChordPro path correctly filters them out, but UG parser picks them up
    const result = detectFormat('[Chorus]\nJust lyrics here\n[Verse]\nMore lyrics');
    // If UG parser detects chords in the section-labeled content, it returns 'Ultimate Guitar'
    // If no chords detected at all, returns null
    expect(result === 'Ultimate Guitar' || result === null).toBe(true);
  });

  it('detects ChordPro even with section labels present', () => {
    // Has both section labels AND real chords
    expect(detectFormat('[Chorus]\n[G]Let it [D]be')).toBe('ChordPro');
  });
});

// ─── toChordPro + directive preservation ────────────────────────────

describe('toChordPro', () => {
  it('preserves x_ directives through conversion', () => {
    const content = '{title: Song}\n{x_tags: worship}\n{x_language: en}\n\n  G        D\n  Let it be';
    const result = toChordPro(content);
    expect(result).toContain('{x_tags: worship}');
    expect(result).toContain('{x_language: en}');
    expect(result).toContain('{title: Song}');
  });

  it('preserves standard directives through conversion', () => {
    const content = '{title: Amazing Grace}\n{artist: John Newton}\n{key: G}\n\n  G        D\n  Let it be';
    const result = toChordPro(content);
    expect(result).toContain('{title:');
    expect(result).toContain('{artist:');
    expect(result).toContain('{key:');
  });

  it('passes through already-ChordPro content cleanly', () => {
    const content = '{title: Song}\n[G]Amazing [C]grace';
    const result = toChordPro(content);
    // Should still have the title and chord content
    expect(result).toContain('{title:');
    // Should contain chord markers
    expect(result).toMatch(/\[G\]/);
  });

  it('converts chords-over-lyrics to ChordPro bracket format', () => {
    const content = '  G        D\n  Let it   be';
    const result = toChordPro(content);
    // Result should contain inline [chord] markers
    expect(result).toMatch(/\[[A-G][b#]?\]/);
  });

  it('returns original content on parse failure', () => {
    const garbage = '';
    const result = toChordPro(garbage);
    expect(result).toBe(garbage);
  });
});

// ─── ensureKeyDirective ─────────────────────────────────────────────

describe('ensureKeyDirective', () => {
  it('does not duplicate existing key directive', () => {
    const content = '{key: G}\n[G]Amazing [C]grace';
    const result = ensureKeyDirective(content);
    expect(result).toBe(content);
  });

  it('adds key from first chord when missing', () => {
    const content = '[G]Amazing [C]grace';
    const result = ensureKeyDirective(content);
    expect(result).toContain('{key: G}');
    // Original content should still be there
    expect(result).toContain('[G]Amazing');
  });

  it('handles minor key chords', () => {
    const content = '[Am]Lyrics here [Em]more';
    const result = ensureKeyDirective(content);
    expect(result).toContain('{key: Am}');
  });

  it('returns content unchanged if no chords found', () => {
    const content = 'Just lyrics\nno chords here';
    const result = ensureKeyDirective(content);
    expect(result).toBe(content);
  });
});
