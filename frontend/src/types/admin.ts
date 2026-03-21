export interface AdminStats {
  userCount: number;
  songCount: number;
  pendingCount: number;
  noFormatCount: number;
  languageDistribution: { language: string; count: number }[];
  recentSongs: {
    id: number;
    title: string;
    artist: string;
    username: string;
    created_at: string;
  }[];
}

export interface AdminUser {
  id: number;
  username: string;
  role: string;
  disabled: boolean;
  song_count: number;
  created_at: string;
}

export interface InviteCode {
  id: number;
  code: string;
  created_at: string;
  used_at: string | null;
}

export interface AdminConfig {
  allowRegistration: boolean;
}
