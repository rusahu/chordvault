const ROLES = { OWNER: 'owner', ADMIN: 'admin', USER: 'user' };

const STATUS = { ACTIVE: 'active', PENDING: 'pending' };

const VISIBILITY = { PUBLIC: 'public', PRIVATE: 'private' };

const LIMITS = {
  MAX_TITLE: 200,
  MAX_CONTENT: 100_000,
  MAX_BPM: 300,
  MIN_BPM: 1,
  MAX_SETLIST_NAME: 200,
  MAX_IMPORT: 500,
  DEMO_MAX_IMPORT: 20,
  MAX_REORDER: 1000,
  MAX_YOUTUBE_URL: 500,
  MAX_SOURCE_URL: 2048,
  TRANSPOSE_MIN: -12,
  TRANSPOSE_MAX: 12,
  USERNAME_MIN: 3,
  USERNAME_MAX: 50,
  PASSWORD_MIN: 6,
  GEMINI_KEY_MIN: 20,
  GEMINI_KEY_MAX: 100,
  MAX_OCR_IMAGE: 18 * 1024 * 1024,
  MAX_BODY_JSON: '18mb',
  MAX_PREFERRED_LANGUAGES: 10,
  MAX_OCR_PROMPT: 5000,
};

const GEMINI_MODELS = [
  { id: 'gemini-3.6-flash', label: 'Flash 3.6', hint: '5/day' },
  { id: 'gemini-3.5-flash', label: 'Flash 3.5', hint: '20/day' },
  { id: 'gemini-3.5-flash-lite', label: 'Flash 3.5 Lite', hint: '15/day' },
  { id: 'gemini-3.1-flash-lite', label: 'Flash 3.1 Lite', hint: '500/day' },
  { id: 'gemini-2.5-flash', label: 'Flash 2.5', hint: '20/day' },
];
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

const isValidGeminiModel = (id) => GEMINI_MODELS.some((m) => m.id === id);

// Falls back to the default so a preference stored before a model was delisted
// resolves to something live instead of 404ing against the Gemini API.
const resolveGeminiModel = (...candidates) => candidates.find(isValidGeminiModel) || DEFAULT_GEMINI_MODEL;

module.exports = {
  ROLES,
  STATUS,
  VISIBILITY,
  LIMITS,
  GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  isValidGeminiModel,
  resolveGeminiModel,
};
