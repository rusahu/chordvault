import guitarData from '@tombatossals/chords-db/lib/guitar.json';
import type { Barre, Chord, Finger } from 'svguitar';

interface DbPosition {
  frets: number[];
  fingers: number[];
  baseFret: number;
  barres: number[];
}

interface DbChord {
  key: string;
  suffix: string;
  positions: DbPosition[];
}

interface GuitarDatabase {
  chords: Record<string, DbChord[]>;
}

const database = guitarData as GuitarDatabase;
const DATABASE_ROOTS: Record<string, string> = {
  'C#': 'Csharp',
  Db: 'Csharp',
  'D#': 'Eb',
  'F#': 'Fsharp',
  Gb: 'Fsharp',
  'G#': 'Ab',
  'A#': 'Bb',
};
const COMMON_OPEN_CHORDS = new Set([
  'C:major',
  'A:major',
  'G:major',
  'E:major',
  'D:major',
  'A:minor',
  'E:minor',
  'D:minor',
]);

function parseSymbol(symbol: string): { root: string; suffix: string } | null {
  const match = symbol.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return null;
  const root = DATABASE_ROOTS[match[1]] || match[1];
  const rawSuffix = match[2];
  const suffix = rawSuffix === '' ? 'major' : rawSuffix === 'm' ? 'minor' : rawSuffix;
  return { root, suffix };
}

export function guitarChordDiagram(symbol: string): Chord | null {
  const parsed = parseSymbol(symbol);
  if (!parsed) return null;
  const entry = database.chords[parsed.root]?.find((chord) => chord.suffix === parsed.suffix);
  const firstPosition = entry?.positions[0];
  const position =
    firstPosition && COMMON_OPEN_CHORDS.has(`${parsed.root}:${parsed.suffix}`)
      ? firstPosition
      : entry?.positions.reduce((best, candidate) => {
          const barreWidth = (item: DbPosition) =>
            Math.max(
              0,
              ...item.barres.map((fret) => {
                const strings = item.frets
                  .map((value, index) => ({ value, string: 6 - index }))
                  .filter(({ value }) => value === fret)
                  .map(({ string }) => string);
                return strings.length > 1 ? Math.max(...strings) - Math.min(...strings) : 0;
              }),
            );
          const candidateWidth = barreWidth(candidate);
          const bestWidth = barreWidth(best);
          if (candidateWidth !== bestWidth) return candidateWidth > bestWidth ? candidate : best;
          return candidate.baseFret < best.baseFret ? candidate : best;
        });
  if (!position) return null;

  const frettedStrings = (fret: number) =>
    position.frets
      .map((value, index) => ({ value, string: 6 - index }))
      .filter(({ value }) => value === fret)
      .map(({ string }) => string);
  const barres: Barre[] = position.barres.flatMap((fret) => {
    const strings = frettedStrings(fret);
    if (strings.length < 2) return [];
    const fromString = Math.max(...strings);
    const toString = Math.min(...strings);
    const fingerIndex = 6 - fromString;
    const finger = position.fingers[fingerIndex];
    return [{ fromString, toString, fret, text: finger ? String(finger) : undefined }];
  });

  const fingers: Finger[] = [];
  position.frets.forEach((fret, index) => {
    const string = 6 - index;
    if (fret < 0) {
      fingers.push([string, 'x']);
      return;
    }
    if (fret === 0) {
      fingers.push([string, 0]);
      return;
    }
    const coveredByBarre = barres.some(
      (barre) => barre.fret === fret && string <= barre.fromString && string >= barre.toString,
    );
    if (coveredByBarre) return;
    const finger = position.fingers[index];
    fingers.push([string, fret, finger ? String(finger) : undefined]);
  });

  return { fingers, barres, position: position.baseFret, title: symbol };
}
