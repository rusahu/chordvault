import 'fake-indexeddb/auto';
import { createOfflineLibrary } from '../offlineLibrary';
import { downloadOfflineLibrary } from '../offlineDownload';
const user = { id: 1, username: 'demo', token: 'token', role: 'user' };
let library: ReturnType<typeof createOfflineLibrary>;
beforeEach(async () => { library = createOfflineLibrary(crypto.randomUUID()); await library.enable(1); });
afterEach(async () => { await library.db.delete(); vi.unstubAllGlobals(); });

it('downloads with authorization and commits only a complete response', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 1, accountId: 1, songs: [], catalog: [], setlists: [] }), { headers: { ETag: 'A' } }));
  vi.stubGlobal('fetch', fetcher);
  await downloadOfflineLibrary(user, library, new AbortController().signal);
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
  expect((await library.state())?.revision).toBe('A');
});

it('keeps the previous snapshot when the network fails', async () => {
  const ticket = (await library.beginRefresh(1))!;
  await library.replaceDownload(ticket, { schemaVersion: 1, accountId: 1, songs: [], catalog: [], setlists: [] }, 'A');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  await expect(downloadOfflineLibrary(user, library, new AbortController().signal)).rejects.toThrow('offline');
  expect((await library.state())?.revision).toBe('A');
});

it('invalidates downloaded data after an authenticated rejection', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
  await expect(downloadOfflineLibrary(user, library, new AbortController().signal)).rejects.toThrow();
  expect((await library.state())?.enabled).toBe(false);
});

it('ignores a late rejection from before the user re-enabled downloads', async () => {
  let respond!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { respond = resolve; })));
  const pending = downloadOfflineLibrary(user, library);
  await vi.waitFor(() => expect(respond).toBeTypeOf('function'));
  await library.disable(1);
  await library.enable(1);
  const epoch = (await library.state())!.epoch;
  respond(new Response('{}', { status: 403 }));
  await expect(pending).rejects.toThrow();
  expect((await library.state())?.enabled).toBe(true);
  expect((await library.state())?.epoch).toBe(epoch);
});
