import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportModal } from '../ImportModal';

vi.mock('../../lib/api', () => ({
  importSongs: vi.fn(async () => ({ imported: 1, skipped: [{ index: 1, reason: 'already_exists' }], errors: [] })),
  ApiError: class extends Error { status = 0; },
}));
vi.mock('../../hooks/useApi', () => ({ useApi: () => vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { token: 'tok' } }) }));
vi.mock('../../context/DemoContext', () => ({ useDemo: () => ({ demoMode: false }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => vi.fn() }));

function file(name: string, content: string) {
  return new File([content], name, { type: 'text/plain' });
}

describe('ImportModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('imports selected files and shows a summary', async () => {
    render(<ImportModal onClose={() => {}} onDone={() => {}} />);
    const input = screen.getByTestId('import-file-input') as HTMLInputElement;
    await userEvent.upload(input, [file('A.cho', '[G]a'), file('B.cho', '[G]a')]);
    await userEvent.click(screen.getByTestId('import-start'));
    await waitFor(() => {
      expect(screen.getByTestId('import-summary')).toHaveTextContent('1 imported');
      expect(screen.getByTestId('import-summary')).toHaveTextContent('1 already in your library');
    });
  });
});
