const languages = require('../shared/languages.json');
const LANGUAGE_CODES = new Set(languages.map(language => language.code));

module.exports = { LANGUAGE_CODES };
