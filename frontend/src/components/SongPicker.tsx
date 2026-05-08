import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import type { SongListItem, SongVersion } from '../types';

interface SongPickerProps {
  onPick: (song: SongListItem) => void;
  onClose: () => void;
}

export function SongPicker({ onPick, onClose }: SongPickerProps) {
  const api = useApi();
  const { t } = useI18n();
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const load = useCallback(async (q = '') => {
    try {
      const data = await api<SongListItem[]>('GET', '/api/songs/public' + (q ? `?q=${encodeURIComponent(q)}` : ''));
      setSongs(data);
      setExpandedId(null);
    } catch { /* ignore */ }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const handleCardClick = async (s: SongListItem) => {
    if (s.version_count && s.version_count > 1) {
      if (expandedId === s.id) {
        setExpandedId(null);
      } else {
        setExpandedId(s.id);
        setLoadingVersions(true);
        try {
          const v = await api<SongVersion[]>('GET', `/api/songs/${s.id}/versions`);
          setVersions(v);
        } catch { /* ignore */ } finally {
          setLoadingVersions(false);
        }
      }
    } else {
      onPick(s);
    }
  };

  return (
    <div className="setlist-add-overlay" data-overlay style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
            <div key={s.id} className="song-picker-item" style={{ display: 'contents' }}>
              <div className="song-card" onClick={() => handleCardClick(s)} style={expandedId === s.id ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : {}}>
                <div className="song-card-info">
                  <div className="song-card-title">{s.title}</div>
                  <div className="song-card-meta">
                    {s.artist || ''}
                    {s.version_count && s.version_count > 1 && (
                      <span className="badge badge-tag" style={{ marginLeft: 8, background: 'var(--accent-alt)', color: 'white', fontSize: 10 }}>
                        {s.version_count} Versions
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {expandedId === s.id && (
                <div className="song-card version-list-card" style={{ gridColumn: '1 / -1', marginTop: -12, paddingTop: 16, borderTopLeftRadius: 0, borderTopRightRadius: 0, background: 'var(--bg-alt)' }}>
                  {loadingVersions ? (
                    <div style={{ padding: 8, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading versions...</div>
                  ) : (
                    <div className="version-items">
                      {versions.map((v) => (
                        <div
                          key={v.id}
                          className="version-item"
                          onClick={() => onPick({ ...s, id: v.id, username: v.username })}
                          style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderRadius: 4, transition: 'background 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontSize: 14 }}>{v.title} <small style={{ color: 'var(--muted)' }}>@{v.username}</small></span>
                          {v.youtube_url && <span style={{ color: 'var(--accent)', fontSize: 12 }}>▶ YT</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
