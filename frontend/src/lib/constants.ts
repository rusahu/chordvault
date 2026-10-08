import shared from '../../../shared/public-constants.json';

export const PRESET_TAGS = [
  'worship', 'praise', 'hymn', 'opener', 'closer', 'communion',
  'christmas', 'easter', 'kids', 'instrumental',
];

export const MAX_LOCAL_SETLISTS = 50;
export const MAX_LOCAL_ENTRIES = 100;
export const MAX_CONTENT_LENGTH = shared.limits.MAX_CONTENT;
export const MAX_BPM = shared.limits.MAX_BPM;
export const MIN_BPM = shared.limits.MIN_BPM;
export const MAX_SETLIST_NAME_LENGTH = shared.limits.MAX_SETLIST_NAME;
export const MAX_PREFERRED_LANGUAGES = shared.limits.MAX_PREFERRED_LANGUAGES;
export const MAX_OCR_PROMPT = shared.limits.MAX_OCR_PROMPT;

export const DEFAULT_GEMINI_MODEL = shared.DEFAULT_GEMINI_MODEL;

export const IMPORT_MAX_BATCH = shared.limits.MAX_IMPORT;
export const IMPORT_MAX_BATCH_BYTES = 12_000_000;
export const IMPORT_CONFIRM_FILE_COUNT = 5000;
export const DEMO_MAX_IMPORT = shared.limits.DEMO_MAX_IMPORT;
export const IMPORT_ACCEPT = '.cho,.chopro,.pro,.chordpro,.crd,.txt';

// Font family registered with jsPDF for PDF export. Lives here rather than in
// pdf-fonts.ts so pdf-config.ts can read the name without pulling in jsPDF.
export const EMBEDDED_FONT = 'NotoSansTC';
