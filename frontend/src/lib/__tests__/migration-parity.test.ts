import { describe, it, expect } from 'vitest';
import { renderChordPro, getSongKey } from '../chords';
import { getTransposeDelta, ALL_KEYS, ALL_KEYS_MINOR } from '../keys';
import { songKeyFromContent } from '../../../../lib/songKey.js';

// The migration writes target_key = songKeyFromContent(content, transpose).
// Rendering must then be byte-identical to rendering the old raw delta.
// 17 live rows flip transposition direction under the new model, and direction
// drives enharmonic spelling, so this is not a tautology.
describe('migration render parity', () => {
  const SAMPLE = (k: string) => `{key: ${k}}
[${k}]a [F]b [Bb]c [F#]d [Gb]e [B]f [Am7]g [D/F#]h [C#m]i [Ab]j [Esus4]k [Cb]l`;

  it('renders identically for every key and every legal stored delta', () => {
    const diffs: string[] = [];
    for (const k of [...ALL_KEYS, ...ALL_KEYS_MINOR]) {
      const content = SAMPLE(k);
      for (let t = -12; t <= 12; t++) {
        const target = songKeyFromContent(content, t);
        expect(target).not.toBe('');
        const delta = getTransposeDelta(getSongKey(content, 0), target);
        if (renderChordPro(content, t) !== renderChordPro(content, delta)) {
          diffs.push(`key=${k} t=${t} target=${target} delta=${delta}`);
        }
      }
    }
    expect(diffs).toEqual([]);
  });

  it('agrees with the frontend full-parse deriver', () => {
    for (const k of ALL_KEYS) {
      const content = SAMPLE(k);
      for (let t = -6; t <= 6; t++) {
        expect(songKeyFromContent(content, t)).toBe(getSongKey(content, t));
      }
    }
  });
});
