import type { Song, Setlist } from './index';

export interface OfflineSong extends Song { familyId: number }
export interface CatalogSong extends Omit<OfflineSong, 'content'> {
  search: { title: string[]; artist: string[]; lyrics: string[]; pinyin: string };
}
export interface OfflineSnapshot {
  schemaVersion: 1;
  accountId: number;
  songs: OfflineSong[];
  catalog: CatalogSong[];
  setlists: Setlist[];
}
export interface RefreshTicket { accountId: number; epoch: string; requestSerial: number }
export interface OfflineState {
  id: 'current';
  accountId: number;
  enabled: boolean;
  epoch: string;
  requestSerial: number;
  revision: string | null;
  contractVersion: number | null;
  downloadedAt: number | null;
  checkedAt: number | null;
  songCount: number;
  setlistCount: number;
}
export interface LibraryQuery {
  q?: string;
  language?: string;
  page?: number;
  limit?: number;
  own?: boolean;
  dateFrom?: string;
  dateTo?: string;
}
