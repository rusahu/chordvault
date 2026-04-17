#!/usr/bin/env node
/**
 * Tests for jsonToChordPro() — the deterministic JSON-to-ChordPro converter.
 * Run: node scripts/test-ocr-convert.mjs
 */
import { createRequire } from 'module';
import assert from 'assert';

const require = createRequire(import.meta.url);
const { jsonToChordPro } = require('../lib/ocr-convert.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log('jsonToChordPro tests\n');

// --- Basic CJK song ---
test('basic CJK song with multiple sections', () => {
  const input = {
    metadata: { title: '不動搖的信心', artist: '游智婷 Sandy', key: 'D', language: 'zh' },
    sections: [
      {
        label: 'Verse',
        lines: [
          { segments: [
            { chord: 'D', lyrics: '主賜給我 ' },
            { chord: 'A/C#', lyrics: '不動 ' },
            { chord: 'F#m', lyrics: '搖的' },
            { chord: 'Bm', lyrics: '信心' },
          ]},
        ],
      },
      {
        label: 'Chorus',
        lines: [
          { segments: [
            { chord: 'G', lyrics: '不退縮也' },
            { chord: 'D/F#', lyrics: '不害怕' },
          ]},
        ],
      },
    ],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('{title: 不動搖的信心}'));
  assert.ok(result.text.includes('{artist: 游智婷 Sandy}'));
  assert.ok(result.text.includes('{key: D}'));
  assert.ok(result.text.includes('{x_language: zh}'));
  assert.ok(result.text.includes('[D]主賜給我 [A/C#]不動 [F#m]搖的[Bm]信心'));
  assert.ok(result.text.includes('[G]不退縮也[D/F#]不害怕'));
  assert.ok(result.text.includes('Verse'));
  assert.ok(result.text.includes('Chorus'));
  assert.equal(result.language, 'zh');
});

// --- Chord-only line ---
test('chord-only line (intro/interlude)', () => {
  const input = {
    sections: [{
      label: 'Intro',
      lines: [{ segments: [
        { chord: 'G', lyrics: '' },
        { chord: 'D', lyrics: '' },
        { chord: 'Em', lyrics: '' },
        { chord: 'C', lyrics: '' },
      ]}],
    }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('[G] [D] [Em] [C]'));
});

// --- Lyrics-only line ---
test('lyrics-only line (null chord)', () => {
  const input = {
    sections: [{
      label: 'Verse',
      lines: [{ segments: [
        { chord: null, lyrics: 'Just lyrics with no chords here' },
      ]}],
    }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('Just lyrics with no chords here'));
  assert.ok(!result.text.includes('['));
});

// --- Chords past end of lyrics ---
test('chord past end of lyrics (empty lyrics segment)', () => {
  const input = {
    sections: [{
      label: 'Verse',
      lines: [{ segments: [
        { chord: 'D', lyrics: '海浪之中' },
        { chord: 'A/C#', lyrics: '我必不沉' },
        { chord: 'D/A', lyrics: '' },
      ]}],
    }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('[D]海浪之中[A/C#]我必不沉[D/A]'));
});

// --- All metadata fields ---
test('all metadata fields emitted as directives', () => {
  const input = {
    metadata: { title: 'Song', artist: 'Artist', key: 'G', capo: '2', tempo: '120', language: 'en' },
    sections: [{ label: 'Verse', lines: [{ segments: [{ chord: 'G', lyrics: 'Hello' }] }] }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('{title: Song}'));
  assert.ok(result.text.includes('{artist: Artist}'));
  assert.ok(result.text.includes('{key: G}'));
  assert.ok(result.text.includes('{capo: 2}'));
  assert.ok(result.text.includes('{tempo: 120}'));
  assert.ok(result.text.includes('{x_language: en}'));
  assert.equal(result.language, 'en');
});

// --- Extra metadata ---
test('extra metadata fields as x_ directives', () => {
  const input = {
    metadata: { title: 'Song', album: 'Best Hits', source: 'Hymnal' },
    sections: [{ label: 'Verse', lines: [{ segments: [{ chord: 'C', lyrics: 'Test' }] }] }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('{x_album: Best Hits}'));
  assert.ok(result.text.includes('{x_source: Hymnal}'));
});

// --- Missing metadata ---
test('missing/partial metadata does not crash or emit empty directives', () => {
  const input = {
    metadata: { title: 'Song' },
    sections: [{ label: 'Verse', lines: [{ segments: [{ chord: 'G', lyrics: 'Hello' }] }] }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('{title: Song}'));
  assert.ok(!result.text.includes('{artist:'));
  assert.ok(!result.text.includes('{key:'));
  assert.equal(result.language, null);
});

// --- No metadata at all ---
test('no metadata object', () => {
  const input = {
    sections: [{ label: 'Verse', lines: [{ segments: [{ chord: 'G', lyrics: 'Hello' }] }] }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('[G]Hello'));
  assert.equal(result.language, null);
});

// --- Empty segments ---
test('empty segments array produces empty line', () => {
  const input = {
    sections: [{ label: 'Verse', lines: [{ segments: [] }] }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('Verse'));
});

// --- Mixed CJK and Latin ---
test('mixed CJK and Latin lyrics', () => {
  const input = {
    sections: [{
      label: 'Verse',
      lines: [{ segments: [
        { chord: 'G', lyrics: 'Amazing ' },
        { chord: 'C', lyrics: 'grace 恩典' },
      ]}],
    }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('[G]Amazing [C]grace 恩典'));
});

// --- Section labels are plain text ---
test('section labels are plain text, not directives', () => {
  const input = {
    sections: [
      { label: 'Verse 1', lines: [{ segments: [{ chord: 'G', lyrics: 'Hello' }] }] },
      { label: 'Pre-Chorus', lines: [{ segments: [{ chord: 'Am', lyrics: 'World' }] }] },
    ],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('Verse 1'));
  assert.ok(result.text.includes('Pre-Chorus'));
  assert.ok(!result.text.includes('{start_of_'));
});

// --- English song ---
test('English song works identically', () => {
  const input = {
    metadata: { title: 'Amazing Grace', artist: 'John Newton', key: 'G', language: 'en' },
    sections: [{
      label: 'Verse',
      lines: [
        { segments: [
          { chord: 'G', lyrics: 'Amazing ' },
          { chord: 'C', lyrics: 'grace how ' },
          { chord: 'G', lyrics: 'sweet the sound' },
        ]},
      ],
    }],
  };
  const result = jsonToChordPro(input);
  assert.ok(result.text.includes('[G]Amazing [C]grace how [G]sweet the sound'));
  assert.equal(result.language, 'en');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
