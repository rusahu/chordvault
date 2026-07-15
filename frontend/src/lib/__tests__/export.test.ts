import { describe, it, expect, vi, afterEach } from 'vitest';
import { filenameFromDisposition, exportSongsBlob } from '../api';

afterEach(() => vi.restoreAllMocks());

describe('filenameFromDisposition', () => {
  it('parses the filename from a Content-Disposition header', () => {
    expect(filenameFromDisposition('attachment; filename="chordvault-export-2026-07-14.zip"', 'x.zip'))
      .toBe('chordvault-export-2026-07-14.zip');
  });
  it('falls back when header is missing', () => {
    expect(filenameFromDisposition(null, 'fallback.zip')).toBe('fallback.zip');
  });
});

describe('exportSongsBlob', () => {
  it('fetches with auth header and returns blob plus filename', async () => {
    const blob = new Blob(['zip']);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob,
      headers: { get: () => 'attachment; filename="out.zip"' },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exportSongsBlob('tok123');

    expect(fetchMock).toHaveBeenCalledWith('/api/songs/export', {
      headers: { Authorization: 'Bearer tok123' },
    });
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe('out.zip');
  });

  it('throws ApiError on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many requests. Please try again later.' }),
    }));
    await expect(exportSongsBlob('tok')).rejects.toMatchObject({ status: 429 });
  });
});
