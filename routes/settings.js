const express = require('express');
const crypto = require('crypto');
const { db, stmts } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { LIMITS } = require('../lib/constants');
const { validatePreferredLanguages } = require('../lib/validation');
const { jsonToChordPro } = require('../lib/ocr-convert');

const JWT_SECRET = process.env.JWT_SECRET;

// JSON-based prompt for structured OCR output (default mode)
const DEFAULT_OCR_PROMPT = `You are a chord sheet OCR tool. Extract chord/lyric data from this image into structured JSON.

For each line of lyrics, break it into segments. Each segment is a chord followed by the lyrics that play under that chord, up to the next chord.

RULES:
- Transcribe chords EXACTLY as shown (keep Gsus2, A/C#, Cmaj7 as-is).
- ONLY transcribe what is visible. NEVER add, invent, or reposition chords.
- Preserve all spacing between character groups in lyrics exactly as shown.
- For chord-only lines (intros, interludes), use segments with empty string lyrics.
- For lyric-only lines (no chords), use a single segment with null chord.
- If a chord is hard to read, give your best guess. Do NOT skip anything.
- Include section labels (Verse, Chorus, Bridge, Intro, Outro, etc.) in the label field.
- Include repeat markers (e.g. "x2") as part of the lyrics text.
- For metadata, only include what is clearly visible on the sheet.
- Set language to the ISO 639-1 code of the lyrics language (e.g. "en", "zh", "ko", "ja").`;

// Schema for Gemini structured output
const OCR_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    metadata: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        artist: { type: 'STRING' },
        key: { type: 'STRING' },
        capo: { type: 'STRING' },
        tempo: { type: 'STRING' },
        language: { type: 'STRING' },
      },
    },
    sections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          lines: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                segments: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      chord: { type: 'STRING', nullable: true },
                      lyrics: { type: 'STRING' },
                    },
                    required: ['lyrics'],
                  },
                },
              },
              required: ['segments'],
            },
          },
        },
        required: ['lines'],
      },
    },
  },
  required: ['sections'],
};

// Text-based prompt for refine endpoint and custom prompt fallback
const OCR_REFINE_PROMPT = `You are a chord sheet OCR tool. Transcribe this image/PDF into ChordPro format.

RULES:
- Place chords inline with lyrics using square brackets: [G]When I [C]find myself
- Each bracket must contain exactly ONE chord.
- Place each [chord] DIRECTLY before the syllable/word it belongs to.
- Transcribe chords EXACTLY as shown. Do NOT normalize or simplify chord names.
- ONLY transcribe what is visible. NEVER add, invent, or reposition chords.
- Preserve all spacing between character groups exactly as shown.
- Use ChordPro directives for metadata: {title: Song Title}, {artist: Artist Name}, {key: G}, {capo: 2}, {tempo: 120}
- Always add: {x_language: <ISO 639-1 code>}
- For chord-only lines: [G] [D] [Em] [C]
- Preserve repeat markers as plain text.

Return ONLY the ChordPro text, no explanations or markdown code fences.`;

/** Derives a 256-bit encryption key from JWT_SECRET using PBKDF2. */
function deriveEncKey() {
  return crypto.pbkdf2Sync(JWT_SECRET, 'chordvault-gemini-enc', 100_000, 32, 'sha256');
}

/**
 * Encrypts a Gemini API key using AES-256-GCM with a random IV.
 * Returns a colon-separated string: `iv:authTag:ciphertext` (all hex-encoded).
 *
 * @param {string} plaintext - The API key to encrypt
 * @returns {string} Encrypted string in format "ivHex:tagHex:encHex"
 */
function encryptApiKey(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveEncKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

/**
 * Decrypts a stored Gemini API key encrypted by encryptApiKey.
 * Parses the "ivHex:tagHex:encHex" format and verifies the auth tag.
 * Throws if the stored value is tampered with or JWT_SECRET has changed.
 *
 * @param {string} stored - Encrypted string from encryptApiKey
 * @returns {string} The original plaintext API key
 */
function decryptApiKey(stored) {
  const [ivHex, tagHex, encHex] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveEncKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

function createSettingsRouter() {
  const router = express.Router();

  router.put('/settings/gemini-key', requireAuth, (req, res) => {
    const { api_key } = req.body;
    if (!api_key || typeof api_key !== 'string') return res.status(400).json({ error: 'API key is required' });
    if (!api_key.startsWith('AIza') || api_key.length < LIMITS.GEMINI_KEY_MIN || api_key.length > LIMITS.GEMINI_KEY_MAX) {
      return res.status(400).json({ error: 'Invalid Gemini API key format' });
    }
    const encrypted = encryptApiKey(api_key);
    db.prepare('UPDATE users SET gemini_api_key = ? WHERE id = ?').run(encrypted, req.user.id);
    res.json({ success: true });
  });

  router.delete('/settings/gemini-key', requireAuth, (req, res) => {
    db.prepare('UPDATE users SET gemini_api_key = NULL WHERE id = ?').run(req.user.id);
    res.json({ success: true });
  });

  router.get('/settings/gemini-key', requireAuth, (req, res) => {
    const user = stmts.getFullUserById.get(req.user.id);
    res.json({ hasKey: !!user?.gemini_api_key });
  });

  router.get('/settings/ocr-prompt', requireAuth, (req, res) => {
    const user = stmts.getFullUserById.get(req.user.id);
    res.json({ prompt: user?.gemini_prompt || null, defaultPrompt: DEFAULT_OCR_PROMPT });
  });

  router.put('/settings/ocr-prompt', requireAuth, (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    if (prompt.length > LIMITS.MAX_OCR_PROMPT) {
      return res.status(400).json({ error: `Prompt must be under ${LIMITS.MAX_OCR_PROMPT} characters` });
    }
    db.prepare('UPDATE users SET gemini_prompt = ? WHERE id = ?').run(prompt.trim(), req.user.id);
    res.json({ success: true });
  });

  router.delete('/settings/ocr-prompt', requireAuth, (req, res) => {
    db.prepare('UPDATE users SET gemini_prompt = NULL WHERE id = ?').run(req.user.id);
    res.json({ success: true });
  });

  router.get('/settings/languages', requireAuth, (req, res) => {
    const user = stmts.getFullUserById.get(req.user.id);
    const languages = user?.preferred_languages ? user.preferred_languages.split(',').filter(Boolean) : [];
    res.json({ languages });
  });

  router.put('/settings/languages', requireAuth, (req, res) => {
    const { languages } = req.body;
    const error = validatePreferredLanguages(languages || []);
    if (error) return res.status(400).json({ error });
    const value = languages.length > 0 ? languages.join(',') : null;
    db.prepare('UPDATE users SET preferred_languages = ? WHERE id = ?').run(value, req.user.id);
    res.json({ success: true });
  });

  router.post('/ocr/gemini', requireAuth, express.json({ limit: LIMITS.MAX_BODY_JSON }), async (req, res) => {
    const { image } = req.body;
    if (!image || typeof image !== 'string') return res.status(400).json({ error: 'Base64 image is required' });

    const sizeEstimate = (image.length * 3) / 4;
    if (sizeEstimate > LIMITS.MAX_OCR_IMAGE) return res.status(400).json({ error: 'File too large (max 18MB)' });

    const user = stmts.getFullUserById.get(req.user.id);
    if (!user?.gemini_api_key) return res.status(400).json({ error: 'No Gemini API key configured. Add one in Settings.' });

    let apiKey;
    try {
      apiKey = decryptApiKey(user.gemini_api_key);
    } catch {
      return res.status(500).json({ error: 'Failed to decrypt API key. Try re-saving it in Settings.' });
    }

    let mimeType = 'image/jpeg';
    const dataUrlMatch = image.match(/^data:((?:image\/(?:jpeg|png|webp|gif))|application\/pdf);base64,/);
    let rawBase64 = image;
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      rawBase64 = image.slice(dataUrlMatch[0].length);
    }

    const isJsonMode = !user.gemini_prompt;
    const prompt = user.gemini_prompt || DEFAULT_OCR_PROMPT;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: rawBase64 } },
        ],
      }],
    };

    if (isJsonMode) {
      requestBody.generationConfig = {
        response_mime_type: 'application/json',
        response_schema: OCR_JSON_SCHEMA,
      };
    }

    try {
      const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(requestBody),
        }
      );

      if (!geminiRes.ok) {
        const errData = await geminiRes.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `Gemini API error (${geminiRes.status})`;
        return res.status(502).json({ error: errMsg });
      }

      let data;
      try { data = await geminiRes.json(); }
      catch { return res.status(502).json({ error: 'Gemini returned an invalid response' }); }

      // Check for blocked content
      if (data?.promptFeedback?.blockReason) {
        return res.status(502).json({ error: `Gemini blocked the request: ${data.promptFeedback.blockReason}` });
      }

      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
        return res.status(502).json({ error: `Gemini could not process the image (${candidate.finishReason}). Try a clearer photo.` });
      }

      const text = candidate?.content?.parts?.[0]?.text || '';
      if (!text) return res.status(502).json({ error: 'Gemini returned no text. Try a clearer image.' });

      if (isJsonMode) {
        let parsed;
        try { parsed = JSON.parse(text); }
        catch { return res.status(502).json({ error: 'Gemini returned invalid JSON. Try again.' }); }
        const result = jsonToChordPro(parsed);
        return res.json({ text: result.text, language: result.language });
      }

      // Legacy text mode (custom prompt users)
      const { LANGUAGE_CODES } = require('../lib/languages');
      const langMatch = text.match(/^DETECTED_LANGUAGE:\s*([a-z]{2})\s*$/m);
      const detectedLang = langMatch && LANGUAGE_CODES.has(langMatch[1]) ? langMatch[1] : null;
      const cleanedText = text.replace(/^DETECTED_LANGUAGE:\s*[a-z]{2}\s*$/m, '').replace(/^```(?:\w+)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();

      res.json({ text: cleanedText, language: detectedLang });
    } catch (e) {
      console.error('Gemini API request failed:', e.message, e.stack);
      res.status(502).json({ error: `Gemini error: ${e.message}` });
    }
  });

  // Refinement endpoint — multi-turn conversation with image context
  router.post('/ocr/gemini/refine', requireAuth, express.json({ limit: LIMITS.MAX_BODY_JSON }), async (req, res) => {
    const { image, history, message } = req.body;
    if (!image || !message || !Array.isArray(history)) {
      return res.status(400).json({ error: 'image, history, and message are required' });
    }
    if (message.length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
    if (history.length > 20) return res.status(400).json({ error: 'Conversation too long. Start a new extraction.' });

    const user = stmts.getFullUserById.get(req.user.id);
    if (!user?.gemini_api_key) return res.status(400).json({ error: 'No Gemini API key configured.' });

    let apiKey;
    try { apiKey = decryptApiKey(user.gemini_api_key); }
    catch { return res.status(500).json({ error: 'Failed to decrypt API key.' }); }

    let mimeType = 'image/jpeg';
    const dataUrlMatch = image.match(/^data:((?:image\/(?:jpeg|png|webp|gif))|application\/pdf);base64,/);
    let rawBase64 = image;
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      rawBase64 = image.slice(dataUrlMatch[0].length);
    }

    // Refine always uses text-based prompt for context (even if initial extraction used JSON mode)
    const refinePrompt = user.gemini_prompt || OCR_REFINE_PROMPT;

    // Build multi-turn contents: initial extraction + conversation history + new message
    const contents = [
      { role: 'user', parts: [{ text: refinePrompt }, { inline_data: { mime_type: mimeType, data: rawBase64 } }] },
    ];
    for (const msg of history) {
      if (msg.role === 'model') contents.push({ role: 'model', parts: [{ text: msg.text }] });
      else if (msg.role === 'user') contents.push({ role: 'user', parts: [{ text: msg.text }] });
    }
    contents.push({
      role: 'user',
      parts: [{ text: `The user wants to fix the chord sheet. Here is their correction:\n\n${message}\n\nApply the correction and return the FULL corrected ChordPro text. Do not include explanations, just the corrected text.` }]
    });

    try {
      const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents })
        }
      );

      if (!geminiRes.ok) {
        const errData = await geminiRes.json().catch(() => ({}));
        return res.status(502).json({ error: errData?.error?.message || `Gemini API error (${geminiRes.status})` });
      }

      let data;
      try { data = await geminiRes.json(); }
      catch { return res.status(502).json({ error: 'Gemini returned an invalid response' }); }

      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
        return res.status(502).json({ error: `Gemini could not process the request (${candidate.finishReason})` });
      }

      const text = candidate?.content?.parts?.[0]?.text || '';
      if (!text) return res.status(502).json({ error: 'Gemini returned no text. Try rephrasing your correction.' });

      // Strip markdown fences if present
      const cleaned = text.replace(/^```(?:chordpro)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();
      res.json({ text: cleaned });
    } catch (e) {
      console.error('Gemini refine failed:', e.message, e.stack);
      res.status(502).json({ error: `Gemini error: ${e.message}` });
    }
  });

  return router;
}

module.exports = { createSettingsRouter, DEFAULT_OCR_PROMPT, OCR_REFINE_PROMPT, OCR_JSON_SCHEMA };
