import { describe, it, expect, beforeEach } from 'vitest';
import { migrateOverride, getSetlistOverrides, saveSetlistOverride } from '../storage';

const content = '{key: G}\n[G]a [C]b [D]c';

describe('localStorage override migration', () => {
  it('converts a legacy transpose override to a target key', () => {
    expect(migrateOverride({ transpose: 2 }, content)).toEqual({ target_key: 'A' });
  });

  it('converts a legacy downward transpose', () => {
    expect(migrateOverride({ transpose: -2 }, content)).toEqual({ target_key: 'F' });
  });

  it('treats a legacy zero transpose as as-written', () => {
    expect(migrateOverride({ transpose: 0 }, content)).toEqual({ target_key: null });
  });

  it('leaves an already-migrated override untouched', () => {
    expect(migrateOverride({ target_key: 'C' }, content)).toEqual({ target_key: 'C' });
  });

  it('prefers target_key when both are present', () => {
    expect(migrateOverride({ target_key: 'C', transpose: 9 }, content)).toEqual({ target_key: 'C' });
  });

  it('preserves the other override fields', () => {
    expect(migrateOverride({ transpose: 2, nashville: true, font: 1, two_col: null }, content))
      .toEqual({ target_key: 'A', nashville: true, font: 1, two_col: null });
  });

  it('falls back to as-written when the key cannot be derived', () => {
    expect(migrateOverride({ transpose: 2 }, '')).toEqual({ target_key: null });
  });

  it('returns as-written for an empty override', () => {
    expect(migrateOverride({}, content)).toEqual({ target_key: null });
  });
});

describe('legacy override retirement on write', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('drops the legacy transpose field when the migrated override is written back', () => {
    localStorage.setItem('cv_setlist_overrides', JSON.stringify({ '1': { '5': { transpose: 2 } } }));
    const raw = getSetlistOverrides(1)['5'];
    saveSetlistOverride(1, 5, migrateOverride(raw, content));
    expect(getSetlistOverrides(1)['5']).toEqual({ target_key: 'A' });
  });
});
