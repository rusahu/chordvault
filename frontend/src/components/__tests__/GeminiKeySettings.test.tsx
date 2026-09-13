import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GeminiKeySettings } from '../GeminiKeySettings';

const mockApiCall = vi.fn();

vi.mock('../../hooks/useApi', () => ({ useApi: () => mockApiCall }));

describe('GeminiKeySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a masked replacement state when a key is configured', async () => {
    mockApiCall.mockResolvedValueOnce({ hasKey: true });
    render(<GeminiKeySettings />);

    expect(await screen.findByText('✓ Key configured')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('•••••••••••• (saved key)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Replace Key' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Key' })).toBeInTheDocument();
  });

  it('updates the configured state after saving and removing a key', async () => {
    mockApiCall
      .mockResolvedValueOnce({ hasKey: false })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });
    render(<GeminiKeySettings />);

    await screen.findByText('No key configured');
    expect(screen.queryByRole('button', { name: 'Remove Key' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Gemini API Key'), { target: { value: `AQ.${'a'.repeat(40)}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Key' }));

    await screen.findByText('✓ Key configured');
    expect(mockApiCall).toHaveBeenCalledWith('PUT', '/api/settings/gemini-key', { api_key: `AQ.${'a'.repeat(40)}` });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Key' }));

    await waitFor(() => expect(screen.getByText('No key configured')).toBeInTheDocument());
    expect(mockApiCall).toHaveBeenCalledWith('DELETE', '/api/settings/gemini-key');
  });
});
