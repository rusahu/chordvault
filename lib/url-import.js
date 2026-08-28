'use strict';

const { LIMITS } = require('./constants');
const { AppError } = require('./errors');
const { LANGUAGE_CODES } = require('./languages');
const { stripFences } = require('./gemini');
const { jsonToChordPro } = require('./ocr-convert');

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0;
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:'))) return true;
  return isPrivateIpv4(host);
}

function validateImportUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return { error: 'URL is required' };
  const raw = value.trim();
  if (raw.length > LIMITS.MAX_SOURCE_URL) {
    return { error: `URL is too long (max ${LIMITS.MAX_SOURCE_URL} characters)` };
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: 'Enter a complete, valid URL including https:// or http://' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { error: 'Only http:// and https:// URLs are supported' };
  }
  if (parsed.username || parsed.password) {
    return { error: 'URLs containing credentials are not supported' };
  }
  if (isPrivateHostname(parsed.hostname)) {
    return { error: 'Local and private-network URLs are not supported' };
  }
  return { url: parsed.href };
}

function addSourceDirective(text, sourceUrl) {
  const withoutSource = text
    .replace(/^\{x_source:\s*[^}]*\}[ \t]*\n?/gim, '')
    .trim();
  const lines = withoutSource.split('\n');
  let insertAt = 0;
  while (insertAt < lines.length && /^\{[a-z_]+:\s*[^}]*\}[ \t]*$/i.test(lines[insertAt])) {
    insertAt++;
  }
  lines.splice(insertAt, 0, `{x_source: ${sourceUrl}}`);
  return lines.join('\n');
}

function assertUrlRetrieved(candidate) {
  const metadata = candidate?.urlContextMetadata || candidate?.url_context_metadata;
  const entries = metadata?.urlMetadata || metadata?.url_metadata;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AppError('Gemini could not access this URL. Check that it is public and try again.', 422, 'URL_UNAVAILABLE');
  }
  const statuses = entries.map((entry) => entry.urlRetrievalStatus || entry.url_retrieval_status || '');
  if (statuses.some((status) => String(status).includes('UNSAFE'))) {
    throw new AppError('Gemini rejected this URL as unsafe.', 422, 'URL_UNSAFE');
  }
  if (!statuses.some((status) => String(status).includes('SUCCESS'))) {
    throw new AppError('This page could not be retrieved. Login-only, paywalled, and blocked pages are not supported.', 422, 'URL_UNAVAILABLE');
  }
}

function supportsToolStructuredOutput(model) {
  return typeof model === 'string' && model.startsWith('gemini-3');
}

function validateExtractedChordSheet(text) {
  const matches = String(text || '').match(/\[([A-G][^\]]*)\]/gi) || [];
  const hasChord = matches.some((match) => {
    const value = match.slice(1, -1).trim();
    return !/^(?:Break|Bridge|Chorus|Coda|Ending|Instrumental|Intro|Interlude|Outro|Pre-?Chorus|Refrain|Solo|Tag|Verse)\b/i.test(value);
  });
  if (!hasChord) {
    throw new AppError('No chord sheet was found at this URL. Check the page and try a more direct link.', 422, 'NO_CHORD_SHEET');
  }
}

function finalizeUrlChordPro(text, sourceUrl) {
  const cleaned = stripFences(text).replace(/^\{x_language:\s*[^}]*\}[ \t]*\n?/im, (directive) => {
    const match = directive.match(/\{x_language:\s*([a-z]{2})\s*\}/i);
    return match && LANGUAGE_CODES.has(match[1].toLowerCase()) ? directive : '';
  });
  validateExtractedChordSheet(cleaned);
  return addSourceDirective(cleaned, sourceUrl);
}

function convertUrlImportResult(rawText, structured, sourceUrl) {
  let text;
  let language;
  if (structured) {
    let parsed;
    try { parsed = JSON.parse(rawText); }
    catch { throw new AppError('Gemini returned invalid JSON. Try again.', 502, 'GEMINI_BAD_JSON'); }
    let converted;
    try { converted = jsonToChordPro(parsed); }
    catch (error) { throw new AppError(`Gemini returned an invalid chord sheet: ${error.message}`, 502, 'GEMINI_CONVERT'); }
    text = converted.text;
    const normalizedLanguage = typeof converted.language === 'string' ? converted.language.toLowerCase() : '';
    language = LANGUAGE_CODES.has(normalizedLanguage) ? normalizedLanguage : null;
  } else {
    text = stripFences(rawText);
    const match = text.match(/^\{x_language:\s*([a-z]{2})\s*\}/im);
    language = match && LANGUAGE_CODES.has(match[1].toLowerCase()) ? match[1].toLowerCase() : null;
  }
  return { text: finalizeUrlChordPro(text, sourceUrl), language };
}

module.exports = {
  validateImportUrl,
  addSourceDirective,
  assertUrlRetrieved,
  supportsToolStructuredOutput,
  validateExtractedChordSheet,
  finalizeUrlChordPro,
  convertUrlImportResult,
};
