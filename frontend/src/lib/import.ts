import { IMPORT_MAX_BATCH, IMPORT_MAX_BATCH_BYTES } from './constants';

const HAS_TITLE = /\{title:/i;

function basename(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

export function fileToSong(filename: string, text: string): { content: string } {
  if (HAS_TITLE.test(text)) return { content: text };
  return { content: `{title: ${basename(filename)}}\n${text}` };
}

export function chunkSongs(songs: { content: string }[]): { content: string }[][] {
  const batches: { content: string }[][] = [];
  let current: { content: string }[] = [];
  let bytes = 0;
  for (const song of songs) {
    const size = new Blob([song.content]).size;
    if (current.length > 0 && (current.length >= IMPORT_MAX_BATCH || bytes + size > IMPORT_MAX_BATCH_BYTES)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(song);
    bytes += size;
  }
  if (current.length) batches.push(current);
  return batches;
}
