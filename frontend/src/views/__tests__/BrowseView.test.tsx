import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowseView } from '../BrowseView';

const mockApi = vi.fn();
vi.mock('../../hooks/useApi', () => ({ useApi: () => mockApi }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => vi.fn() }));
vi.mock('../../components/SongCard', () => ({ SongCard: () => null }));
vi.mock('../../components/Pagination', () => ({ Pagination: () => null }));

describe('BrowseView filters', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mockApi.mockImplementation((_method: string, path: string) => {
      if (path === '/api/songs/public/tags') return Promise.resolve({ tags: ['Romantic', 'Acoustic'] });
      const page = Number(new URL(path, 'http://test').searchParams.get('page'));
      return Promise.resolve({ songs: [], total: 0, page, limit: 20, totalPages: 0 });
    });
  });

  it('combines language and multiple tag filters and persists them', async () => {
    render(<BrowseView navigate={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Filters'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } });
    fireEvent.click(await screen.findByRole('button', { name: /All tags/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Romantic' }));

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith('GET', expect.stringMatching(/language=en.*tags=Romantic.*page=1/)),
    );
    expect(sessionStorage.getItem('cv_browse_lang')).toBe('en');
    expect(sessionStorage.getItem('cv_browse_tags')).toBe('["Romantic"]');
    expect(sessionStorage.getItem('cv_browse_show_filters')).toBe('true');
  });
});
