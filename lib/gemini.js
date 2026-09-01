const { AppError } = require('./errors');

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const OK_FINISH = new Set(['STOP', 'MAX_TOKENS']);
const DATA_URL_RE = /^data:((?:image\/(?:jpeg|png|webp|gif))|application\/pdf);base64,/;

// No prefix means bare base64, which the OCR endpoints have always accepted.
function parseDataUrl(image) {
  const m = image.match(DATA_URL_RE);
  if (!m) return { mimeType: 'image/jpeg', base64: image };
  return { mimeType: m[1], base64: image.slice(m[0].length) };
}

function stripFences(text) {
  return text
    .replace(/^```(?:\w*)\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}

async function callGeminiDetailed({ apiKey, model, contents, schema, tools, subject = 'request', retryHint = '' }) {
  const body = { contents };
  if (tools) body.tools = tools;
  if (schema) {
    body.generationConfig = { response_mime_type: 'application/json', response_schema: schema };
  }

  let res;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('Gemini API request failed:', e.message, e.stack);
    throw new AppError(`Gemini error: ${e.message}`, 502, 'GEMINI_NETWORK');
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new AppError(
      errData?.error?.message || `Gemini API error (${res.status})`,
      502,
      'GEMINI_HTTP',
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new AppError('Gemini returned an invalid response', 502, 'GEMINI_BAD_JSON');
  }

  // Only set when there are no candidates, so it must be read before candidates[0].
  if (data?.promptFeedback?.blockReason) {
    throw new AppError(
      `Gemini blocked the request: ${data.promptFeedback.blockReason}`,
      502,
      'GEMINI_BLOCKED',
    );
  }

  const candidate = data?.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish && !OK_FINISH.has(finish)) {
    throw new AppError(
      `Gemini could not process the ${subject} (${finish}). ${retryHint}`.trim(),
      502,
      'GEMINI_FINISH',
    );
  }

  const text = candidate?.content?.parts?.[0]?.text || '';
  if (!text) {
    throw new AppError(`Gemini returned no text. ${retryHint}`.trim(), 502, 'GEMINI_EMPTY');
  }
  return { text, candidate, response: data };
}

async function callGemini(args) {
  const result = await callGeminiDetailed(args);
  return result.text;
}

module.exports = { parseDataUrl, stripFences, callGemini, callGeminiDetailed };
