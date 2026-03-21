export interface Song {
  id: number;
  title: string;
  artist: string;
  content: string;
  visibility: string;
  youtube_url: string | null;
  bpm: number | null;
  tags: string | null;
  language: string;
  format_detected: string | null;
  username: string;
  user_id: number;
  parent_id: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  key?: string;
}

export interface SongListItem {
  id: number;
  title: string;
  artist: string;
  key: string | null;
  bpm: number | null;
  tags: string | null;
  language: string;
  visibility: string;
  username: string;
  youtube_url?: string | null;
}

export interface Correction {
  id: number;
  title: string;
  content: string;
  username: string;
  submitter: string;
  parent_id: number;
  created_at: string;
}

export interface SongVersion {
  id: number;
  title: string;
  username: string;
  parent_id: number | null;
  youtube_url: string | null;
}
