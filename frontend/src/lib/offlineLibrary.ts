import Dexie, { type Table } from 'dexie';
import type { Setlist, SongListItem } from '../types';
import type { CatalogSong, LibraryQuery, OfflineSnapshot, OfflineSong, OfflineState, RefreshTicket } from '../types/offline';

type Database = Dexie & {
  songs: Table<OfflineSong, number>;
  catalog: Table<CatalogSong, number>;
  setlists: Table<Setlist, number>;
  state: Table<OfflineState, string>;
};
const unavailable = () => new Error('This item is not available in your downloaded library. Connect and refresh your download.');
const freshState = (accountId: number): OfflineState => ({
  id: 'current', accountId, enabled: true, epoch: crypto.randomUUID(), requestSerial: 0,
  revision: null, contractVersion: null, downloadedAt: null, checkedAt: null, songCount: 0, setlistCount: 0,
});
const matches = (state: OfflineState | undefined, ticket: RefreshTicket) => state?.enabled &&
  state.accountId === ticket.accountId && state.epoch === ticket.epoch && state.requestSerial === ticket.requestSerial;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function identifiedRows(rows: unknown): rows is Record<string, unknown>[] {
  return Array.isArray(rows) && rows.every(row => record(row) && Number.isSafeInteger(row.id) && Number(row.id) > 0) &&
    new Set(rows.map(row => row.id)).size === rows.length;
}
export function validateSnapshot(value: unknown, accountId: number): asserts value is OfflineSnapshot {
  if (!record(value) || value.schemaVersion !== 1 || value.accountId !== accountId ||
      !identifiedRows(value.songs) || !identifiedRows(value.catalog) || !identifiedRows(value.setlists)) {
    throw new Error('Invalid offline library download');
  }
  const ids = new Set(value.songs.map(s => s.id));
  const songs = new Map(value.songs.map(s => [s.id, s]));
  if (value.catalog.length !== ids.size || value.songs.some(s => typeof s.content !== 'string' ||
      typeof s.title !== 'string' || typeof s.updated_at !== 'string' || typeof s.created_at !== 'string' || !Number.isSafeInteger(s.familyId) || s.status !== 'active' ||
      (s.visibility !== 'public' && s.user_id !== accountId)) ||
      value.catalog.some(s => !ids.has(s.id) || ['familyId', 'user_id', 'title', 'artist', 'visibility', 'status', 'language', 'updated_at', 'created_at'].some(key => s[key] !== songs.get(s.id)?.[key]) || !record(s.search) || typeof s.search.pinyin !== 'string' ||
        !['title', 'artist', 'lyrics'].every(key => Array.isArray((s.search as Record<string, unknown>)[key]) &&
          ((s.search as Record<string, unknown>)[key] as unknown[]).every(v => typeof v === 'string'))) ||
      value.setlists.some(s => s.user_id !== accountId || typeof s.name !== 'string' || !Array.isArray(s.entries) ||
        s.entries.some(e => !record(e) || typeof e.content !== 'string' || typeof e.title !== 'string' ||
          !Number.isSafeInteger(e.song_id) || (e.is_private_placeholder && (e.content !== '' || e.content_override !== null))))) {
    throw new Error('Incomplete offline library download');
  }
}

function pageInfo(total: number, query: LibraryQuery) {
  const limit = Math.max(1, Math.min(100, query.limit || 20));
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(totalPages, Math.max(1, query.page || 1));
  return { total, page, limit, totalPages };
}

export function createOfflineLibrary(name = 'chordvault-offline') {
  const db = new Dexie(name) as Database;
  db.version(1).stores({ songs: 'id,familyId', catalog: 'id,familyId,user_id,language', setlists: 'id', state: 'id' });
  const tables = [db.songs, db.catalog, db.setlists, db.state];
  const state = () => db.state.get('current');
  const clearRows = async () => { await db.songs.clear(); await db.catalog.clear(); await db.setlists.clear(); };
  async function enable(accountId: number) {
    await db.transaction('rw', tables, async () => {
      const current = await state();
      if (current?.enabled && current.accountId === accountId) return;
      await clearRows();
      await db.state.put(freshState(accountId));
    });
  }
  async function invalidate(accountId: number, disable = false, ticket?: RefreshTicket) {
    await db.transaction('rw', tables, async () => {
      const current = await state();
      if (current?.accountId !== accountId || (ticket && !matches(current, ticket))) return;
      await clearRows();
      await db.state.put({ ...freshState(accountId), enabled: !disable && current.enabled });
    });
  }
  async function beginRefresh(accountId: number): Promise<RefreshTicket | null> {
    return db.transaction('rw', db.state, async () => {
      const current = await state();
      if (!current?.enabled || current.accountId !== accountId) return null;
      const requestSerial = current.requestSerial + 1;
      await db.state.put({ ...current, requestSerial });
      return { accountId, epoch: current.epoch, requestSerial };
    });
  }
  async function replaceDownload(ticket: RefreshTicket, snapshot: unknown, revision: string) {
    validateSnapshot(snapshot, ticket.accountId);
    if (!revision) throw new Error('Missing offline library revision');
    return db.transaction('rw', tables, async () => {
      const current = await state();
      if (!matches(current, ticket)) return false;
      await clearRows();
      await db.songs.bulkPut(snapshot.songs);
      await db.catalog.bulkPut(snapshot.catalog);
      await db.setlists.bulkPut(snapshot.setlists);
      const now = Date.now();
      await db.state.put({ ...current!, revision, contractVersion: 1, downloadedAt: now, checkedAt: now,
        songCount: snapshot.songs.length, setlistCount: snapshot.setlists.length });
      return true;
    });
  }
  async function markChecked(ticket: RefreshTicket, revision: string) {
    return db.transaction('rw', tables, async () => {
      const current = await state();
      if (!current || !matches(current, ticket) || current.revision !== revision || !await complete(current)) return false;
      await db.state.put({ ...current, checkedAt: Date.now() });
      return true;
    });
  }
  async function complete(current: OfflineState) {
    return current.contractVersion === 1 && await db.songs.count() === current.songCount &&
      await db.catalog.count() === current.songCount && await db.setlists.count() === current.setlistCount;
  }
  async function status() {
    return db.transaction('r', tables, async () => {
      const current = await state();
      return current?.revision && !await complete(current) ? { ...current, revision: null, downloadedAt: null } : current;
    });
  }
  async function read<T>(accountId: number, callback: () => Promise<T>): Promise<T> {
    return db.transaction('r', tables, async () => {
      const current = await state();
      if (!current?.enabled || current.accountId !== accountId || !current.revision || !await complete(current)) throw unavailable();
      return callback();
    });
  }
  const getSong = (accountId: number, id: number) => read(accountId, async () => {
    const song = await db.songs.get(id);
    if (!song) throw unavailable();
    return song;
  });
  const getVersions = (accountId: number, id: number) => read(accountId, async () => {
    const song = await db.songs.get(id);
    if (!song) throw unavailable();
    return db.songs.where('familyId').equals(song.familyId).sortBy('created_at');
  });
  const getSetlist = (accountId: number, id: number) => read(accountId, async () => {
    const setlist = await db.setlists.get(id);
    if (!setlist) throw unavailable();
    return setlist;
  });
  const querySongs = (accountId: number, query: LibraryQuery) => read(accountId, async () => {
    const terms = (query.q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const pinyin = terms.join('');
    const groups = new Map<number, { row: CatalogSong; score: number }>();
    const counts = new Map<number, number>();
    await db.catalog.each(row => {
      counts.set(row.familyId, (counts.get(row.familyId) || 0) + 1);
      if (query.own ? row.user_id !== accountId : row.visibility !== 'public') return;
      if (query.language && row.language !== query.language) return;
      const fieldMatch = (forms: string[]) => terms.every(term => forms.some(form => form.includes(term)));
      const { title, artist, lyrics } = row.search;
      if (terms.length && !fieldMatch([...title, ...artist, ...lyrics]) && !row.search.pinyin.includes(pinyin)) return;
      const score = terms.length ? (fieldMatch(title) ? 2 : fieldMatch(artist) ? 1 : 0) : 0;
      const previous = groups.get(row.familyId);
      if (!previous || score > previous.score || (score === previous.score && row.updated_at > previous.row.updated_at)) {
        groups.set(row.familyId, { row, score });
      }
    });
    const results = [...groups.values()].sort((a, b) => b.score - a.score || b.row.updated_at.localeCompare(a.row.updated_at) || a.row.id - b.row.id);
    const paging = pageInfo(results.length, query);
    const songs: SongListItem[] = results.slice((paging.page - 1) * paging.limit, paging.page * paging.limit).map(({ row }) => {
      const { search: _, familyId, ...metadata } = row;
      return { ...metadata, version_count: counts.get(familyId) || 1, key: row.key ?? null };
    });
    return { ...paging, songs };
  });
  const querySetlists = (accountId: number, query: LibraryQuery) => read(accountId, async () => {
    const rows = (await db.setlists.toArray()).filter(s => (!query.q || s.name.toLowerCase().includes(query.q.toLowerCase())) &&
      (!query.dateFrom || (s.event_date && s.event_date >= query.dateFrom)) && (!query.dateTo || (s.event_date && s.event_date <= query.dateTo)))
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '') || Number(a.id) - Number(b.id));
    const paging = pageInfo(rows.length, query);
    return { ...paging, setlists: rows.slice((paging.page - 1) * paging.limit, paging.page * paging.limit).map(({ entries, ...s }) => ({ ...s, song_count: entries.length })) };
  });
  return { db, state, status, enable, invalidate, disable: (accountId: number, ticket?: RefreshTicket) => invalidate(accountId, true, ticket), beginRefresh,
    replaceDownload, markChecked, getSong, getVersions, getSetlist, querySongs, querySetlists };
}

export const offlineLibrary = createOfflineLibrary();
