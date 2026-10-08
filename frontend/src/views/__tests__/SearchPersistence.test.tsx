import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowseView } from '../BrowseView';
import { MySongsView } from '../MySongsView';
import { SetlistsView } from '../SetlistsView';
import { PublicSetlistsView } from '../PublicSetlistsView';
import { AuthProvider, useAuth } from '../../context/AuthContext';

const { api, toast } = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn() }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => api }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (s: string) => s }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: toast }));
const user = { id: 1, username: 'demo', role: 'admin', token: 'fake' };
const navigate = vi.fn();
const cases = [
  { View: BrowseView, prefix: 'cv_browse', path: '/api/songs/public' },
  { View: MySongsView, prefix: 'cv_mysongs', path: '/api/songs' },
  { View: SetlistsView, prefix: 'cv_setlists', path: '/api/setlists' },
  { View: PublicSetlistsView, prefix: 'cv_publicsetlists', path: '/api/setlists/public' },
];
const data = { songs: [], setlists: [{ id: 1, name: 'Sunday', song_count: 1, username: 'demo' }], page: 1, totalPages: 1 };

beforeEach(() => {
  sessionStorage.clear(); localStorage.clear();
  localStorage.setItem('cv_user', JSON.stringify(user));
  api.mockReset().mockResolvedValue(data); toast.mockReset();
});

for (const { View, prefix, path } of cases) {
  describe(prefix, () => {
    const mount = () => render(<AuthProvider><View navigate={navigate} /></AuthProvider>);
    it('retains successful raw searches, discards drafts and failed submissions, and clears', async () => {
      sessionStorage.setItem(`${prefix}_query`, '恩典 Grace');
      const view = mount();
      await waitFor(() => expect(api).toHaveBeenCalledWith('GET', expect.stringContaining('q=%E6%81%A9%E5%85%B8%20Grace')));
      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'unfinished' } });
      expect(sessionStorage.getItem(`${prefix}_query`)).toBe('恩典 Grace');
      view.unmount(); mount();
      expect(screen.getByRole('searchbox')).toHaveValue('恩典 Grace');
      await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
      api.mockRejectedValueOnce(new Error('Search failed'));
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'failed' } });
      fireEvent.click(screen.getByRole('button', { name: 'songs.search' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Search failed');
      expect(sessionStorage.getItem(`${prefix}_query`)).toBe('恩典 Grace');
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Holy' } });
      fireEvent.click(screen.getByRole('button', { name: 'songs.search' }));
      await waitFor(() => expect(sessionStorage.getItem(`${prefix}_query`)).toBe('Holy'));
      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
      await waitFor(() => expect(sessionStorage.getItem(`${prefix}_query`)).toBe(''));
    });

    it.each(['', 'wat', '0', '-1', '1.5', 'Infinity', '2junk'])('normalizes invalid stored page %s', async value => {
      sessionStorage.setItem(`${prefix}_page`, value);
      mount();
      await waitFor(() => expect(api).toHaveBeenCalledWith('GET', `${path}?page=1&limit=20`));
    });

    it('uses a valid legacy page and saves the server-normalized page', async () => {
      sessionStorage.setItem(`${prefix}_page`, '4');
      mount();
      await waitFor(() => expect(api).toHaveBeenCalledWith('GET', `${path}?page=4&limit=20`));
      await waitFor(() => expect(sessionStorage.getItem(`${prefix}_page`)).toBe('1'));
    });

    it('does not restore old searches when a request finishes after an account change', async () => {
      let complete!: (value: typeof data) => void;
      api.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
      sessionStorage.setItem(`${prefix}_query`, 'old identity');
      function Harness() {
        const { user, login, logout } = useAuth();
        return <><button onClick={() => { logout(); login({ id: 2, username: 'second', role: 'user', token: 'next' }); }}>Switch account</button><View key={user?.id ?? 'guest'} navigate={navigate} /></>;
      }
      render(<AuthProvider><Harness /></AuthProvider>);
      await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole('button', { name: 'Switch account' }));
      await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
      await act(async () => complete(data));
      expect(sessionStorage.getItem(`${prefix}_query`)).not.toBe('old identity');
      expect(screen.getByRole('searchbox')).toHaveValue('');
    });
  });
}

for (const { View, prefix, path } of cases.filter(c => c.prefix.includes('setlists'))) {
  it(`${prefix} retains hidden date filters and saves visibility immediately`, async () => {
    sessionStorage.setItem(`${prefix}_date_from`, '2026-10-01');
    sessionStorage.setItem(`${prefix}_date_to`, '2026-10-31');
    sessionStorage.setItem(`${prefix}_show_dates`, 'false');
    render(<AuthProvider><View navigate={navigate} /></AuthProvider>);
    await waitFor(() => expect(api).toHaveBeenCalledWith('GET', `${path}?date_from=2026-10-01&date_to=2026-10-31&page=1&limit=20`));
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filter by date' }));
    expect(sessionStorage.getItem(`${prefix}_show_dates`)).toBe('true');
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
    api.mockRejectedValueOnce(new Error('Date search failed'));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
    if (prefix === 'cv_setlists') fireEvent.click(screen.getByRole('button', { name: 'songs.search' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Date search failed');
    expect(sessionStorage.getItem(`${prefix}_date_from`)).toBe('2026-10-01');
  });
}

it('preserves raw language and immediate filter visibility', async () => {
  sessionStorage.setItem('cv_browse_lang', 'zh');
  render(<AuthProvider><BrowseView navigate={navigate} /></AuthProvider>);
  await waitFor(() => expect(api).toHaveBeenCalledWith('GET', '/api/songs/public?language=zh&page=1&limit=20'));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(sessionStorage.getItem('cv_browse_show_filters')).toBe('true');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } });
  await waitFor(() => expect(sessionStorage.getItem('cv_browse_lang')).toBe('en'));
});

it('rechecks the stored account on focus without replacing an unchanged user', async () => {
  let current: ReturnType<typeof useAuth>['user'] = null;
  function Probe() { current = useAuth().user; return <span>{current?.username || 'signed out'}</span>; }
  render(<AuthProvider><Probe /></AuthProvider>);
  const before = current;
  fireEvent.focus(window);
  expect(current).toBe(before);
  localStorage.removeItem('cv_user');
  fireEvent.focus(window);
  expect(await screen.findByText('signed out')).toBeInTheDocument();
});
