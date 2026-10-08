import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { createOfflineLibrary } from '../offlineLibrary';
import type { OfflineSnapshot } from '../../types/offline';

function snapshot(accountId = 1): OfflineSnapshot {
  const songs = [1, 2, 3].map(id => ({
    id, familyId: id === 2 ? 1 : id, parent_id: id === 2 ? 1 : null,
    user_id: accountId, title: id === 3 ? '喜樂' : 'Amazing Grace', artist: 'Anonymous',
    content: '[C]Sing', visibility: 'public', status: 'active', key: 'C', language: id === 3 ? 'zh' : 'en',
    username: 'demo', youtube_url: null, bpm: null, tags: null, format_detected: null,
    created_at: '2026-01-01', updated_at: `2026-01-0${id}`,
  }));
  return { schemaVersion: 1, accountId, songs, catalog: songs.map(({ content: _, ...s }) => ({
    ...s, search: { title: [s.title.toLowerCase(), ...(s.id === 3 ? ['喜乐'] : [])],
      artist: ['anonymous'], lyrics: ['sing'], pinyin: s.id === 3 ? 'xile' : 'amazinggrace' },
  })), setlists: [{ id: 1, user_id: accountId, name: 'Worship', visibility: 'private', event_date: null, entries: [] }] };
}

let library: ReturnType<typeof createOfflineLibrary>;
beforeEach(async () => {
  library = createOfflineLibrary(`offline-test-${crypto.randomUUID()}`);
  await library.enable(1);
});
afterEach(async () => { await library.db.delete(); vi.restoreAllMocks(); });
async function save(data = snapshot(), revision = 'A') {
  const ticket = await library.beginRefresh(data.accountId);
  expect(ticket).not.toBeNull();
  return library.replaceDownload(ticket!, data, revision);
}

it('stores a complete snapshot, groups versions and finds both Chinese scripts and pinyin', async () => {
  expect(await save()).toBe(true);
  expect((await library.querySongs(1, {})).total).toBe(2);
  expect((await library.getVersions(1, 1)).length).toBe(2);
  for (const q of ['喜樂', '喜乐', 'xi le']) {
    expect((await library.querySongs(1, { q })).songs.map(s => s.id)).toEqual([3]);
  }
  expect((await library.getSong(1, 2)).content).toBe('[C]Sing');
  expect((await library.querySetlists(1, {})).setlists[0].name).toBe('Worship');
});

it('rolls back every table and the completed timestamp when a late bulk write fails', async () => {
  await save();
  const before = await library.state();
  const changed = snapshot();
  changed.songs[0].content = 'new';
  vi.spyOn(library.db.setlists, 'bulkPut').mockRejectedValueOnce(new Error('quota'));
  await expect(save(changed, 'B')).rejects.toThrow('quota');
  expect((await library.getSong(1, 1)).content).toBe('[C]Sing');
  expect((await library.state())?.revision).toBe('A');
  expect((await library.state())?.downloadedAt).toBe(before?.downloadedAt);
});

it('rejects an old response after disable, re-enable and account changes', async () => {
  const old = (await library.beginRefresh(1))!;
  await library.disable(1);
  await library.enable(1);
  expect(await library.replaceDownload(old, snapshot(), 'old')).toBe(false);
  await save();
  await library.enable(2);
  await expect(library.getSong(1, 1)).rejects.toThrow();
  await save(snapshot(2));
  await library.disable(1);
  expect((await library.getSong(2, 1)).user_id).toBe(2);
});

it('does not let out-of-order responses from two connections overwrite a later request', async () => {
  const second = createOfflineLibrary(library.db.name);
  try {
    const old = (await library.beginRefresh(1))!;
    const current = (await second.beginRefresh(1))!;
    expect(await second.replaceDownload(current, snapshot(), 'new')).toBe(true);
    expect(await library.replaceDownload(old, snapshot(), 'old')).toBe(false);
    expect((await library.state())?.revision).toBe('new');
  } finally { second.db.close(); }
});

it('rejects malformed snapshots before replacing a completed download', async () => {
  await save();
  const broken = snapshot();
  broken.songs.push(broken.songs[0]);
  await expect(save(broken, 'B')).rejects.toThrow();
  expect((await library.state())?.revision).toBe('A');
});

it('commits an empty snapshot and only advances checkedAt for a matching 304', async () => {
  await save();
  const ticket = (await library.beginRefresh(1))!;
  expect(await library.markChecked(ticket, 'wrong')).toBe(false);
  expect(await library.markChecked(ticket, 'A')).toBe(true);
  await save({ schemaVersion: 1, accountId: 1, songs: [], catalog: [], setlists: [] }, 'empty');
  expect((await library.querySongs(1, {})).total).toBe(0);
  expect((await library.state())?.songCount).toBe(0);
});

it('does not report an evicted partial download as ready or serve its remaining rows', async () => {
  await save();
  await library.db.catalog.delete(2);
  expect((await library.status())?.revision).toBeNull();
  await expect(library.getSong(1, 1)).rejects.toThrow('not available');
});

it('rejects catalog metadata that does not describe the downloaded song', async () => {
  await save();
  const invalid = snapshot();
  invalid.catalog[0].user_id = 99;
  await expect(save(invalid, 'bad')).rejects.toThrow();
  expect((await library.state())?.revision).toBe('A');
});

it('does not accept a 304 as validation of an unsupported stored contract', async () => {
  await save();
  await library.db.state.update('current', { contractVersion: 2 });
  const ticket = (await library.beginRefresh(1))!;
  expect(await library.markChecked(ticket, 'A')).toBe(false);
  expect((await library.status())?.revision).toBeNull();
});

it('rejects a superseded response even when the newer request fails', async () => {
  await save();
  const older = (await library.beginRefresh(1))!;
  const newer = (await library.beginRefresh(1))!;
  await expect(library.replaceDownload(newer, { schemaVersion: 2 }, 'bad')).rejects.toThrow();
  expect(await library.replaceDownload(older, snapshot(), 'stale')).toBe(false);
  expect((await library.state())?.revision).toBe('A');
});

it('allows another tab to upgrade storage without changing hydrated playback data', async () => {
  await save();
  const playing = await library.getSong(1, 1);
  const upgraded = new Dexie(library.db.name);
  upgraded.version(2).stores({});
  try {
    await upgraded.open();
    expect(library.db.isOpen()).toBe(false);
    expect(playing.content).toBe('[C]Sing');
    await expect(library.getSong(1, 1)).rejects.toThrow();
  } finally { upgraded.close(); }
});
