import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { EmptyState } from '../components/EmptyState';

interface LocalSetlistsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function LocalSetlistsView({ navigate }: LocalSetlistsViewProps) {
  const { t } = useI18n();
  const toast = useToast();
  const ls = useLocalSetlists();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (showNew && nameRef.current) nameRef.current.focus(); }, [showNew]);

  const createLocal = () => {
    if (!newName.trim()) { toast(t('setlist.nameRequired'), 'error'); return; }
    if (newName.length > 200) { toast('Name too long', 'error'); return; }
    const sl = ls.create(newName.trim());
    if (!sl) { toast('Max 50 setlists', 'error'); return; }
    toast(t('setlist.created'), 'success');
    navigate('local-setlist-edit', { id: sl.id });
  };

  return (
    <>
      <div className="view-header">
        <h2 className="view-title">{t('nav.mySetlists')}</h2>
        <button className="btn btn-sm" onClick={() => setShowNew(true)}>{t('setlist.newSetlist')}</button>
      </div>
      <div className="setlist-tabs">
        <button className="setlist-tab active">My Setlists</button>
        <button className="setlist-tab" onClick={() => navigate('public-setlists')}>Public Setlists</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        These setlists are saved in your browser. Sign in to create server-synced setlists.
      </p>
      {showNew && (
        <div className="search-row" style={{ marginBottom: 16 }}>
          <input
            ref={nameRef}
            type="text"
            placeholder={t('setlist.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createLocal(); }}
          />
          <button className="btn btn-sm" onClick={createLocal}>{t('setlist.create')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>{t('songEdit.cancel')}</button>
        </div>
      )}
      <div className="song-grid">
        {ls.setlists.length === 0 ? (
          <EmptyState icon="&#127926;" text={t('setlist.noSetlists')} />
        ) : (
          ls.setlists.map((sl) => (
            <div key={sl.id} className="song-card setlist-card" onClick={() => navigate('local-setlist-edit', { id: sl.id })}>
              <div className="song-card-info">
                <div className="song-card-title">{sl.name}</div>
                <div className="song-card-meta">{sl.entries.length} {sl.entries.length !== 1 ? t('admin.songPlural') : t('admin.song')}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
