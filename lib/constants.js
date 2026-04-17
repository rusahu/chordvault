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
  MAX_REORDER: 1000,
  MAX_YOUTUBE_URL: 500,
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
  { id: 'gemini-3.1-flash-lite-preview', label: 'Flash 3.1 Lite', hint: 'Fast · 500/day' },
  { id: 'gemini-3-flash-preview', label: 'Flash 3', hint: 'Accurate · 20/day' },
  { id: 'gemini-2.5-flash', label: 'Flash 2.5', hint: 'Stable · 20/day' },
  { id: 'gemini-2.5-flash-lite', label: 'Flash 2.5 Lite', hint: 'Lite · 20/day' },
];
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

module.exports = { ROLES, STATUS, VISIBILITY, LIMITS, GEMINI_MODELS, DEFAULT_GEMINI_MODEL };
