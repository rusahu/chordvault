import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { OfflineProvider, useOffline, useOfflineActivity } from './OfflineContext';
import { offlineLibrary } from '../lib/offlineLibrary';
import { downloadOfflineLibrary } from '../lib/offlineDownload';

const { user, logout } = vi.hoisted(() => ({ user: { id: 7, username: 'fixture', role: 'user', token: 'test' }, logout: vi.fn() }));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user, logout }) }));
vi.mock('../lib/offlineDownload', () => ({ downloadOfflineLibrary: vi.fn(async () => true) }));
function View({ playing }: { playing: boolean }) {
  useOfflineActivity(playing);
  const offline = useOffline();
  return <><span>{offline.readOnly ? 'read only' : 'online'}</span><button onClick={() => void offline.refresh(true)}>Refresh</button></>;
}
beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.setItem('cv_user', JSON.stringify(user));
  await offlineLibrary.db.open();
  await offlineLibrary.enable(user.id);
  vi.mocked(downloadOfflineLibrary).mockImplementation(async () => { await offlineLibrary.db.state.update('current', { checkedAt: Date.now() }); return true; });
});
afterEach(async () => { await offlineLibrary.db.delete(); localStorage.clear(); vi.restoreAllMocks(); });
it('defers automatic downloads throughout playback, then checks after leaving', async () => {
  const view = render(<OfflineProvider><View playing /></OfflineProvider>);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(downloadOfflineLibrary).not.toHaveBeenCalled();
  view.rerender(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await waitFor(() => expect(downloadOfflineLibrary).toHaveBeenCalledOnce());
});
it('does not start a request from a tab whose stored account changed', async () => {
  localStorage.setItem('cv_user', JSON.stringify({ ...user, id: 8 }));
  render(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await act(async () => { screen.getByText('Refresh').click(); window.dispatchEvent(new Event('focus')); });
  expect(downloadOfflineLibrary).not.toHaveBeenCalled();
});
it('blocks duplicate pending refreshes', async () => {
  let finish!: (value: boolean) => void;
  vi.mocked(downloadOfflineLibrary).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await waitFor(() => expect(downloadOfflineLibrary).toHaveBeenCalledOnce());
  await act(async () => { screen.getByText('Refresh').click(); screen.getByText('Refresh').click(); });
  expect(downloadOfflineLibrary).toHaveBeenCalledOnce();
  await act(async () => finish(true));
});
