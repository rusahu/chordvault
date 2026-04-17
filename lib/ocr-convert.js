'use strict';

/**
 * Converts structured JSON (from Gemini OCR) to ChordPro format.
 * Each segment pairs a chord with the lyrics that play under it.
 * Conversion is deterministic — no spacing math or column counting.
 */
/** Strip bar-line markers (|) that Gemini sometimes copies from chord sheet notation. */
function cleanChord(chord) {
  return chord.replace(/\|/g, '').trim();
}

function jsonToChordPro(parsed) {
  const lines = [];
  const meta = parsed.metadata || {};

  // Emit known metadata as ChordPro directives
  if (meta.title) lines.push(`{title: ${meta.title}}`);
  if (meta.artist) lines.push(`{artist: ${meta.artist}}`);
  if (meta.key) lines.push(`{key: ${meta.key}}`);
  if (meta.capo) lines.push(`{capo: ${meta.capo}}`);
  if (meta.tempo) lines.push(`{tempo: ${meta.tempo}}`);
  if (meta.language) lines.push(`{x_language: ${meta.language}}`);

  // Any extra metadata keys → {x_<key>: value}
  const KNOWN_KEYS = ['title', 'artist', 'key', 'capo', 'tempo', 'language'];
  for (const [k, v] of Object.entries(meta)) {
    if (!KNOWN_KEYS.includes(k) && v) {
      lines.push(`{x_${k}: ${v}}`);
    }
  }

  for (const section of (parsed.sections || [])) {
    lines.push('');
    if (section.label) lines.push(section.label);

    for (const line of (section.lines || [])) {
      const segs = line.segments || [];
      if (segs.length === 0) {
        lines.push('');
        continue;
      }

      const allEmpty = segs.every(s => !s.lyrics || !s.lyrics.trim());

      if (allEmpty) {
        // Chord-only line (intros, interludes)
        lines.push(segs.filter(s => s.chord).map(s => `[${cleanChord(s.chord)}]`).join(' '));
      } else {
        // Normal line: [chord]lyrics pairs
        lines.push(segs.map(s => {
          const c = s.chord ? `[${cleanChord(s.chord)}]` : '';
          return c + (s.lyrics || '');
        }).join(''));
      }
    }
  }

  return { text: lines.join('\n'), language: meta.language || null };
}

module.exports = { jsonToChordPro };
