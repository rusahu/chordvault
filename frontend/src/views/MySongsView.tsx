import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { SongCard } from '../components/SongCard';
import { EmptyState } from '../components/EmptyState';
import type { SongListItem } from '../types';

interface MySongsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function MySongsView({ navigate }: MySongsViewProps) {
  const api = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback((q = '') => {
    let url = '/api/songs';
    if (q.trim()) url += `?q=${encodeURIComponent(q.trim())}`;
    
    api<SongListItem[]>('GET', url)
      .then((data) => { setSongs(data); setLoaded(true); })
      .catch((e) => toast(e.message, 'error'));
  }, [api, toast]);

  useEffect(() => { load(); }, [load]);

  const doSearch = () => load(query);

  return (
    <>
      <div className="view-header">
        <h2 className="view-title">{t('songs.mySongs')}</h2>
      </div>
      <div className="search-row">
        <input
          type="search"
          placeholder={t('songs.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
        />
        <button className="btn btn-ghost btn-sm" onClick={doSearch}>{t('songs.search')}</button>
        <button className="btn btn-sm" onClick={() => navigate('song-edit')}>{t('songs.newSong')}</button>
      </div>
      <div className="song-grid">
        {loaded && songs.length === 0 ? (
          <EmptyState
            icon="&#127928;"
            text={query ? t('songs.noMatches') : t('songs.noSongs')}
            action={!query ? { label: t('songs.addFirst'), onClick: () => navigate('song-edit') } : undefined}
          />
        ) : (
          songs.map((s) => (
            <SongCard
              key={s.id}
              song={s}
              isOwner
              onClick={() => navigate('song-view', { id: String(s.id) })}
              onEdit={() => navigate('song-edit', { id: String(s.id) })}
            />
          ))
        )}
      </div>
    </>
  );
}
