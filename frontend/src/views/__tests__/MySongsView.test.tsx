import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MySongsView } from '../MySongsView';

const mockApi = vi.fn();
const mockToast = vi.fn();

vi.mock('../../hooks/useApi', () => ({ useApi: () => mockApi }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => mockToast }));
vi.mock('../../components/SongCard', () => ({ SongCard: ({ song }: { song: { title: string } }) => <div>{song.title}</div> }));
vi.mock('../../components/Pagination', () => ({ Pagination: () => null }));

describe('MySongsView tag filtering', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mockApi.mockImplementation((_method: string, path: string) => {
      if (path === '/api/songs/tags') return Promise.resolve({ tags: ['Romantic', 'Slow Dance'] });
      const page = Number(new URL(path, 'http://test').searchParams.get('page'));
      return Promise.resolve({ songs: [], total: 0, page, limit: 20, totalPages: 0 });
    });
  });

  it('combines tag chips with text search and persists selected filters', async () => {
    render(<MySongsView navigate={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('songs.searchPlaceholder'), { target: { value: 'date' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Romantic' }));

    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('GET', expect.stringContaining('tags=Romantic')));
    const filteredUrl = mockApi.mock.calls.map((call) => call[1] as string).find((path) => path.includes('tags=Romantic'))!;
    expect(filteredUrl).toContain('q=date');
    expect(filteredUrl).toContain('page=1');
    expect(sessionStorage.getItem('cv_mysongs_tags')).toBe('["Romantic"]');
  });

  it('restores filters and clears all selected tags', async () => {
    sessionStorage.setItem('cv_mysongs_tags', '["Slow Dance"]');
    sessionStorage.setItem('cv_mysongs_page', '3');
    render(<MySongsView navigate={vi.fn()} />);

    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('GET', expect.stringMatching(/tags=Slow%20Dance.*page=3/)));
    fireEvent.click(await screen.findByRole('button', { name: 'Clear tags' }));
    await waitFor(() => expect(sessionStorage.getItem('cv_mysongs_tags')).toBe('[]'));
    expect(mockApi).toHaveBeenCalledWith('GET', expect.stringMatching(/page=1/));
  });

  it('combines language with dropdown tags and resets pagination', async () => {
    render(<MySongsView navigate={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Filters'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fr' } });
    fireEvent.click(await screen.findByRole('button', { name: /All tags/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Romantic' }));

    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('GET', expect.stringMatching(/language=fr.*tags=Romantic.*page=1/)));
    expect(sessionStorage.getItem('cv_mysongs_lang')).toBe('fr');
    expect(sessionStorage.getItem('cv_mysongs_show_filters')).toBe('true');
  });
});
