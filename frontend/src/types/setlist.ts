export interface SetlistEntry {
  entry_id: number | string;
  song_id: number;
  title: string;
  artist: string;
  content: string;
  content_override: string | null;
  transpose: number;
  nashville: number;
  bpm: number | null;
  youtube_url: string | null;
  language: string;
  is_private_placeholder?: boolean;
  visibility?: string;
  // Per-song overrides (runtime only)
  _num?: number | null;
  _twoCol?: boolean | null;
  _font?: number | null;
  _hideYt?: boolean | null;
}

export interface Setlist {
  id: number | string;
  name: string;
  visibility: string;
  event_date: string | null;
  user_id?: number;
  song_count?: number;
  username?: string;
  entries: SetlistEntry[];
  created_at?: string;
  updated_at?: string;
  isLocal?: boolean;
}

export interface SetlistListItem {
  id: number;
  name: string;
  visibility: string;
  event_date: string | null;
  song_count: number;
  username?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LocalSetlistEntry {
  song_id: number;
  title: string;
  artist: string;
  transpose: number;
  nashville: number;
}

export interface LocalSetlist {
  id: string;
  name: string;
  entries: LocalSetlistEntry[];
}
