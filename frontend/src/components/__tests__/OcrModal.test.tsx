import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportSongModal } from '../OcrModal';

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('../../hooks/useApi', () => ({ useApi: () => apiMock }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => toastMock }));

describe('ImportSongModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.mockImplementation((method: string, path: string) => {
      if (method === 'GET' && path === '/api/settings/ocr-model') {
        return Promise.resolve({
          model: 'gemini-3.6-flash',
          models: [{ id: 'gemini-3.6-flash', label: 'Flash 3.6', hint: '5/day' }],
        });
      }
      if (method === 'POST' && path === '/api/import/url') {
        return Promise.resolve({
          text: '{title: Test}\n{x_source: https://example.com/song}\n{x_language: en}\n[G]Hello',
          language: 'en',
          sourceUrl: 'https://example.com/song',
        });
      }
      return Promise.reject(new Error(`Unexpected API call: ${method} ${path}`));
    });
  });

  it('imports a public URL and hands the result to the editor', async () => {
    const onResult = vi.fn();
    const onClose = vi.fn();
    render(<ImportSongModal hasGeminiKey onResult={onResult} onClose={onClose} />);

    expect(screen.getByRole('tab', { name: 'From URL' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.type(screen.getByLabelText('Public webpage or PDF URL'), 'https://example.com/song');
    await userEvent.click(screen.getByRole('button', { name: /Extract chord sheet/ }));

    await screen.findByDisplayValue(/\{title: Test\}/);
    expect(apiMock).toHaveBeenCalledWith('POST', '/api/import/url', {
      url: 'https://example.com/song',
      model: 'gemini-3.6-flash',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Use in editor' }));
    expect(onResult).toHaveBeenCalledWith(expect.stringContaining('{x_source: https://example.com/song}'), 'en');
    expect(onClose).toHaveBeenCalled();
  });

  it('retains the upload-file option', async () => {
    render(<ImportSongModal hasGeminiKey onResult={() => {}} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Upload file' }));
    expect(screen.getByLabelText('Select image or PDF')).toHaveAttribute('accept', 'image/*,application/pdf');
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('GET', '/api/settings/ocr-model'));
  });
});
