import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import type { SongListItem } from '../types';

interface SongPickerProps {
  onPick: (song: SongListItem) => void;
  onClose: () => void;
}

export function SongPicker({ onPick, onClose }: SongPickerProps) {
  const api = useApi();
  const { t } = useI18n();
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [search, setSearch] = useState('');

  const load = async (q = '') => {
    try {
      const data = await api<SongListItem[]>('GET', '/api/songs/public' + (q ? `?q=${encodeURIComponent(q)}` : ''));
      setSongs(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="setlist-add-overlay" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="setlist-add-content">
        <div className="view-header">
          <h3 className="view-title">{t('setlist.pickSong')}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#10005;</button>
        </div>
        <div className="search-row" style={{ marginBottom: 8 }}>
          <input
            type="search"
            placeholder={t('songs.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(search); }}
            autoFocus
          />
          <button className="btn btn-ghost btn-sm" onClick={() => load(search)}>Search</button>
        </div>
        <div className="song-grid">
          {songs.length === 0 ? (
            <div className="empty"><div className="empty-text">{t('songs.noPublicSongs')}</div></div>
          ) : songs.map((s) => (
            <div key={s.id} className="song-card" onClick={() => onPick(s)}>
              <div className="song-card-info">
                <div className="song-card-title">{s.title}</div>
                <div className="song-card-meta">{s.artist || ''}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
