import { describe, expect, it } from 'vitest';
import { safeExternalHttpUrl } from '../util';

describe('safeExternalHttpUrl', () => {
  it('accepts and normalizes HTTP(S) links', () => {
    expect(safeExternalHttpUrl('https://Example.com/song')).toBe('https://example.com/song');
    expect(safeExternalHttpUrl('http://example.com/song')).toBe('http://example.com/song');
  });

  it('rejects unsafe protocols and malformed values', () => {
    expect(safeExternalHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalHttpUrl('data:text/html,hello')).toBeNull();
    expect(safeExternalHttpUrl('not a url')).toBeNull();
    expect(safeExternalHttpUrl(null)).toBeNull();
  });
});
