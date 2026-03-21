const express = require('express');
const crypto = require('crypto');
const { db, stmts } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { LIMITS } = require('../lib/constants');
const { validatePreferredLanguages } = require('../lib/validation');

const JWT_SECRET = process.env.JWT_SECRET;

const DEFAULT_OCR_PROMPT = `You are reading a photo of a song chord sheet. Extract all lyrics and chords.

In chord sheets, chords are positioned ABOVE the lyrics — align each chord to the syllable it sits over. Output in ChordPro format with chords inline in square brackets before the syllable, e.g. [G]Amazing [D]grace.

For chord-only lines (common in intros/interludes), output just the chords: [G] [D] [Em] [C]

Separate into sections using ChordPro directives: {start_of_intro}, {start_of_verse}, {start_of_chorus}, {start_of_bridge}, {start_of_interlude}, {start_of_ending} with matching {end_of_*} tags.
If sections aren't labeled in the image, infer them from the structure.
If a section repeats, label it (e.g. {start_of_verse: Verse 2}).
Preserve repeat markers (e.g. "x2") as {comment: x2}.

If you see a title, include {title: Song Title}.
If you see an artist, include {artist: Artist Name}.
If you see a key, include {key: G}.
If you see a capo indication, include {capo: 2}.

Return ONLY the ChordPro text, no explanations or markdown.

Identify the language of the lyrics and return it on a separate line at the very end:
DETECTED_LANGUAGE: <ISO 639-1 code>

For example: DETECTED_LANGUAGE: en for English, DETECTED_LANGUAGE: ko for Korean.
If the language is unclear, omit this line.`;

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

  router.post('/ocr/gemini', requireAuth, express.json({ limit: '15mb' }), async (req, res) => {
    const { image } = req.body;
    if (!image || typeof image !== 'string') return res.status(400).json({ error: 'Base64 image is required' });

    const sizeEstimate = (image.length * 3) / 4;
    if (sizeEstimate > LIMITS.MAX_OCR_IMAGE) return res.status(400).json({ error: 'Image too large (max 10MB)' });

    const user = stmts.getFullUserById.get(req.user.id);
    if (!user?.gemini_api_key) return res.status(400).json({ error: 'No Gemini API key configured. Add one in Settings.' });

    let apiKey;
    try {
      apiKey = decryptApiKey(user.gemini_api_key);
    } catch {
      return res.status(500).json({ error: 'Failed to decrypt API key. Try re-saving it in Settings.' });
    }

    let mimeType = 'image/jpeg';
    const dataUrlMatch = image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,/);
    let rawBase64 = image;
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      rawBase64 = image.slice(dataUrlMatch[0].length);
    }

    const prompt = user.gemini_prompt || DEFAULT_OCR_PROMPT;

    try {
      const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: rawBase64 } }
              ]
            }]
          })
        }
      );

      if (!geminiRes.ok) {
        const errData = await geminiRes.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `Gemini API error (${geminiRes.status})`;
        return res.status(502).json({ error: errMsg });
      }

      const data = await geminiRes.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) return res.status(502).json({ error: 'Gemini returned no text' });

      const { LANGUAGE_CODES } = require('../lib/languages');
      const langMatch = text.match(/^DETECTED_LANGUAGE:\s*([a-z]{2})\s*$/m);
      const detectedLang = langMatch && LANGUAGE_CODES.has(langMatch[1]) ? langMatch[1] : null;
      const cleanedText = text.replace(/^DETECTED_LANGUAGE:\s*[a-z]{2}\s*$/m, '').trim();

      res.json({ text: cleanedText, language: detectedLang });
    } catch (e) {
      console.error('Gemini API request failed:', e.message);
      res.status(502).json({ error: 'Failed to reach Gemini API' });
    }
  });

  return router;
}

module.exports = { createSettingsRouter, DEFAULT_OCR_PROMPT };
