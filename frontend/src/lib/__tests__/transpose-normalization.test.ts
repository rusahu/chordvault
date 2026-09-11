import { describe, it, expect } from 'vitest';
import { renderChordPro, getSongKey } from '../chords';
import { normalizeTranspose, ALL_KEYS, ALL_KEYS_MINOR } from '../keys';

const SAMPLE = (key: string) => `{title: T}
{key: ${key}}
[${key}]Amazing [${key}7]grace how [F]sweet the [Bb]sound
[Cb]That [F#]saved a [Gb]wretch like [B]me
[Am7]I [D/F#]once was [Esus4]lost but [C#m]now am [Ab]found`;

describe('transpose normalization', () => {
  // Normalizing an accumulated transpose must be invisible: it may only change
  // the stored number, never the rendered sheet.
  it('renders identically for a raw value and its normalized form', () => {
    const mismatches: string[] = [];
    for (const key of ALL_KEYS) {
      const content = SAMPLE(key);
      for (let t = -36; t <= 36; t++) {
        const n = normalizeTranspose(t);
        if (renderChordPro(content, t) !== renderChordPro(content, n)) {
          mismatches.push(`key=${key} t=${t} -> n=${n}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('reports the same key badge for a raw value and its normalized form', () => {
    const mismatches: string[] = [];
    for (const key of ALL_KEYS) {
      const content = SAMPLE(key);
      for (let t = -36; t <= 36; t++) {
        const n = normalizeTranspose(t);
        const a = getSongKey(content, t);
        const b = getSongKey(content, n);
        if (a !== b) mismatches.push(`key=${key} t=${t}(${a}) vs n=${n}(${b})`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('enharmonic spelling under signed transpose', () => {
  // Signed deltas made downward transposition reachable for the first time, and
  // descending spells flat-ward. Guards the Cb and Fb entries in ENHARMONIC_MAP.
  const QUALITIES = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'dim', 'aug', '9', 'm9', 'add9', '6', 'm6', '7sus4'];
  const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
  const AWKWARD = /^(Cb|Fb|E#|B#)/;
  const DOUBLE = /(##|bb)/;

  it('never renders Cb, Fb, E#, B# or a double accidental in any key', () => {
    const body = ROOTS.flatMap(r => QUALITIES.map(q => `[${r}${q}]x`)).join(' ')
      + ' ' + ROOTS.map(r => `[C/${r}]y`).join(' ');
    const found = new Set<string>();
    for (const key of [...ALL_KEYS, ...ALL_KEYS_MINOR]) {
      const content = `{key: ${key}}\n${body}`;
      for (let t = -11; t <= 11; t++) {
        for (const m of renderChordPro(content, t).matchAll(/class="chord"[^>]*>([^<]*)</g)) {
          const chord = m[1].trim();
          if (!chord) continue;
          for (const part of chord.split('/')) {
            if (AWKWARD.test(part) || DOUBLE.test(part)) found.add(part);
          }
        }
      }
    }
    expect([...found].sort()).toEqual([]);
  });
});
