import { describe, it, expect } from 'vitest';
import { renderChordPro } from '../chords';
import { ALL_KEYS, ALL_KEYS_MINOR } from '../keys';

// Descending transposition spells flat-ward, which is how Fb first appeared.
// Guards the Cb and Fb entries in ENHARMONIC_MAP.
describe('enharmonic spelling coverage', () => {
  const QUALITIES = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'dim', 'aug', '9', 'm9', 'add9', '6', 'm6', '7sus4'];
  const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
  const AWKWARD = /^(Cb|Fb|E#|B#)/;
  const DOUBLE = /(##|bb)/;

  it('never renders Cb, Fb, E#, B# or a double accidental in any key', () => {
    const body = ROOTS.flatMap((r) => QUALITIES.map((q) => `[${r}${q}]x`)).join(' ')
      + ' ' + ROOTS.map((r) => `[C/${r}]y`).join(' ');
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
