const { limits, DEFAULT_GEMINI_MODEL } = require('../shared/public-constants.json');

const ROLES = { OWNER: 'owner', ADMIN: 'admin', USER: 'user' };

const STATUS = { ACTIVE: 'active', PENDING: 'pending' };

const VISIBILITY = { PUBLIC: 'public', PRIVATE: 'private' };

const LIMITS = {
  ...limits,
  MAX_TITLE: 200,
  MAX_REORDER: 1000,
  MAX_YOUTUBE_URL: 500,
  USERNAME_MIN: 3,
  USERNAME_MAX: 50,
  PASSWORD_MIN: 6,
  GEMINI_KEY_MIN: 20,
  GEMINI_KEY_MAX: 100,
  MAX_OCR_IMAGE: 18 * 1024 * 1024,
  MAX_BODY_JSON: '18mb',
};

const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Flash 3.8' },
  { id: 'gemini-3.7-flash', label: 'Flash 3.7' },
  { id: 'gemini-3.6-flash', label: 'Flash 3.6' },
  { id: 'gemini-3.5-flash', label: 'Flash 3.5' },
  { id: 'gemini-3.5-flash-lite', label: 'Flash 3.5 Lite' },
  { id: 'gemini-3.1-flash-lite', label: 'Flash 3.1 Lite' },
  { id: 'gemini-2.5-flash', label: 'Flash 2.5' },
];

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
