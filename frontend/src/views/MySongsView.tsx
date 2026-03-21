import { useState, useEffect } from 'react';
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<SongListItem[]>('GET', '/api/songs')
      .then((data) => { setSongs(data); setLoaded(true); })
      .catch((e) => toast(e.message, 'error'));
  }, []);

  return (
    <>
      <div className="view-header">
        <h2 className="view-title">{t('songs.mySongs')}</h2>
        <button className="btn btn-sm" onClick={() => navigate('song-edit')}>{t('songs.newSong')}</button>
      </div>
      <div className="song-grid">
        {loaded && songs.length === 0 ? (
          <EmptyState
            icon="&#127928;"
            text={t('songs.noSongs')}
            action={{ label: t('songs.addFirst'), onClick: () => navigate('song-edit') }}
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
