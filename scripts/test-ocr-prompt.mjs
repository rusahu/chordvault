#!/usr/bin/env node
/**
 * Test OCR prompts against Gemini API.
 *
 * Usage:
 *   GEMINI_KEY=AIza... node scripts/test-ocr-prompt.mjs <image-path> [--prompt current|simple|both]
 *
 * Defaults to --prompt both (runs both prompts and prints side-by-side).
 */
import { readFileSync } from 'fs';
import { basename, extname } from 'path';

// ── Prompts ──────────────────────────────────────────────────────────────────

const CURRENT_PROMPT = `You are a chord sheet OCR tool. Transcribe this image/PDF into ChordPro format.

RULES:
- Place chords inline with lyrics using square brackets: [G]When I [C]find myself
- Each bracket must contain exactly ONE chord. Never put multiple chords in one bracket like [Bm Em7]. Instead write [Bm]word [Em7]word.
- Place each [chord] DIRECTLY before the syllable/word it belongs to.
- Transcribe chords EXACTLY as shown. Do NOT normalize or simplify chord names (e.g. keep Gsus2 not G2, keep Cmaj7 not Cma7).
- ONLY transcribe what is visible. NEVER add, invent, or reposition chords.
- If a chord is hard to read, give your best guess. Do NOT skip it or add extras.
- For Chinese/Japanese/Korean (CJK) lyrics:
  - IMPORTANT: CJK characters are double-width. To align chords correctly, count each CJK character as 2 columns and each Latin character or space as 1 column. Match the starting column of each chord in the chord line to the character at that same column position in the lyrics line below. If you treat CJK characters as single-width, chords will drift rightward onto the wrong characters.
  - Place [chord] before the exact CJK character it appears above, even if that is in the middle of a continuous character sequence.
  - Preserve all spacing between character groups exactly as shown. These spaces indicate phrasing and must NOT be removed.
  - Example: if the image shows:
      C       Em  Am      F     G   C
      求你降下 同  在  在你子民的敬拜中
    Column counting: 求(0-1) 你(2-3) 降(4-5) 下(6-7) space(8) 同(9-10) space(11) space(12) 在(13-14) space(15) space(16) 在(17-18) 你(19-20) 子(21-22) 民(23-24) 的(25-26) 敬(27-28) 拜(29-30) 中(31-32)
    C=col0→求, Em=col8→同, Am=col12→在, F=col16→在, G=col26→敬, C=col31→中
    Result: [C]求你降下 [Em]同 [Am]在 [F]在你子民的[G]敬拜[C]中
- Use ChordPro directives for metadata (only if clearly visible on the sheet):
  {title: Song Title}
  {artist: Artist Name}
  {key: G}
  {capo: 2}
  {tempo: 120}
- Always add a language directive based on the lyrics language: {x_language: <ISO 639-1 code>}
- Use section directives: {start_of_verse}, {end_of_verse}, {start_of_chorus}, {end_of_chorus}, {start_of_bridge}, {end_of_bridge}, {start_of_intro}, {end_of_intro}, {start_of_outro}, {end_of_outro}
- For chord-only lines (intros, interludes), write each chord in its own bracket: [G] [D] [Em] [C]
- Preserve repeat markers (e.g. "x2", "2x") as plain text.

Return ONLY the ChordPro text, no explanations or markdown code fences.

On the very last line, identify the language (for backward compatibility):
DETECTED_LANGUAGE: <ISO 639-1 code>
For example: DETECTED_LANGUAGE: en, DETECTED_LANGUAGE: ko.
If the language is unclear, omit this line.`;

const SIMPLE_PROMPT = `You are a chord sheet transcription tool. Your job is to transcribe chord sheets from images or PDFs.

OUTPUT FORMAT — two parts:

PART 1 — METADATA (at the very top, only if clearly visible on the sheet):
Use ChordPro directives for any metadata you can see:
  {title: Song Title}
  {artist: Artist Name}
  {key: G}
  {capo: 2}
  {tempo: 120}
Include any other visible metadata as additional directives (e.g. {album: ...}, {source: ...}).
Always add a language directive based on the lyrics language: {x_language: <ISO 639-1 code>}

PART 2 — CHORD SHEET BODY (after the metadata):
Transcribe chords on one line and lyrics on the line directly below, preserving the layout exactly.

Example:
  C       Em  Am      F     G   C
  求你降下 同  在  在你子民的敬拜中

CRITICAL RULES:
- Transcribe chords EXACTLY as shown. Do NOT normalize or simplify (keep Gsus2, A/C#, Cmaj7 as-is).
- ONLY transcribe what is visible. NEVER add, invent, or reposition chords.
- Preserve ALL spacing EXACTLY as shown — horizontal chord positions and spaces between lyric characters MUST match the original. Spacing determines which chord belongs above which syllable. Getting the spacing wrong ruins the chord sheet.
- Each chord line must be immediately followed by its corresponding lyric line.
- For chord-only lines (intros, interludes), write the chords with their spacing preserved.
- Section labels (Verse, Chorus, Bridge, Intro, Outro, etc.) go on their own line as plain text. Do NOT use brackets like [Verse] or directives like {start_of_verse}.
- Preserve repeat markers (e.g. "x2", "2x") as plain text.
- Do NOT use square brackets around chords. Do NOT convert to ChordPro inline format.
- If something is hard to read, give your best guess. Do NOT skip anything.

Return ONLY the transcribed text, no explanations or markdown code fences.

On the very last line, identify the language:
DETECTED_LANGUAGE: <ISO 639-1 code>
For example: DETECTED_LANGUAGE: en, DETECTED_LANGUAGE: zh.
If the language is unclear, omit this line.`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' };
  return map[ext] || 'image/jpeg';
}

async function callGemini(apiKey, prompt, base64Data, mimeType, model = 'gemini-2.5-flash') {
  const start = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }]
      })
    }
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API ${res.status}: ${err?.error?.message || 'Unknown error'}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data?.usageMetadata || {};
  return { text, elapsed, usage };
}

function printResult(label, result) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Time: ${result.elapsed}s | Tokens: in=${result.usage.promptTokenCount || '?'} out=${result.usage.candidatesTokenCount || '?'}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(result.text);
  console.log(`${'─'.repeat(60)}\n`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const apiKey = process.env.GEMINI_KEY;
if (!apiKey) {
  console.error('Error: Set GEMINI_KEY environment variable.\n  GEMINI_KEY=AIza... node scripts/test-ocr-prompt.mjs <image>');
  process.exit(1);
}

const args = process.argv.slice(2);
const imagePath = args.find(a => !a.startsWith('--'));
if (!imagePath) {
  console.error('Usage: GEMINI_KEY=AIza... node scripts/test-ocr-prompt.mjs <image-path> [--prompt current|simple|both]');
  process.exit(1);
}

const promptFlag = (args.find(a => a.startsWith('--prompt='))?.split('=')[1]) || 'both';
const model = (args.find(a => a.startsWith('--model='))?.split('=')[1]) || 'gemini-2.5-flash';

console.log(`\nImage: ${basename(imagePath)} (${getMimeType(imagePath)})`);
console.log(`Model: ${model}`);
console.log(`Prompt mode: ${promptFlag}`);

const base64Data = readFileSync(imagePath).toString('base64');
const mimeType = getMimeType(imagePath);

if (promptFlag === 'current' || promptFlag === 'both') {
  console.log('\nRunning CURRENT prompt (ChordPro output)...');
  try {
    const result = await callGemini(apiKey, CURRENT_PROMPT, base64Data, mimeType, model);
    printResult('CURRENT PROMPT (ChordPro output)', result);
  } catch (e) {
    console.error('Current prompt failed:', e.message);
  }
}

if (promptFlag === 'simple' || promptFlag === 'both') {
  console.log('Running SIMPLE prompt (chords-over-lyrics output)...');
  try {
    const result = await callGemini(apiKey, SIMPLE_PROMPT, base64Data, mimeType, model);
    printResult('SIMPLE PROMPT (chords-over-lyrics output)', result);
  } catch (e) {
    console.error('Simple prompt failed:', e.message);
  }
}
