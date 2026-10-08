import { describe, it, expect } from 'vitest';
import shared from '../../../../shared/public-constants.json';
import { ALL_KEYS, ALL_KEYS_MINOR, normalizeKey } from '../keys';
import { LANGUAGES, LANGUAGE_CODES, languageName } from '../languages';
import * as constants from '../constants';

describe('shared browser definitions', () => {
  it('keeps all 12 major/minor picker choices and existing spelling', () => {
    expect(ALL_KEYS).toEqual(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']);
    expect(ALL_KEYS_MINOR).toEqual(ALL_KEYS.map(key => key + 'm'));
    expect(normalizeKey('Db')).toBe('C#');
    expect(normalizeKey('unknown')).toBe('unknown');
    expect(ALL_KEYS).not.toContain('H');
  });
  it('keeps language names, ordering, unique codes and unknown fallback', () => {
    expect(LANGUAGES).toHaveLength(94);
    expect(LANGUAGE_CODES.size).toBe(94);
    expect(LANGUAGES[0]).toEqual({ code: 'af', name: 'Afrikaans' });
    expect(languageName('zh')).toBe('Chinese');
    expect(languageName('qq')).toBe('QQ');
  });
  it('uses the public limits and default without changing browser-only limits', () => {
    expect(constants.MAX_CONTENT_LENGTH).toBe(shared.limits.MAX_CONTENT);
    expect(constants.MAX_SETLIST_NAME_LENGTH).toBe(shared.limits.MAX_SETLIST_NAME);
    expect(constants.IMPORT_MAX_BATCH).toBe(shared.limits.MAX_IMPORT);
    expect(constants.DEFAULT_GEMINI_MODEL).toBe(shared.DEFAULT_GEMINI_MODEL);
    expect(constants.IMPORT_MAX_BATCH_BYTES).toBe(12_000_000);
    expect(constants.MAX_LOCAL_ENTRIES).toBe(100);
  });
});
