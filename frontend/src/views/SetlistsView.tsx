import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { SetlistCard } from '../components/SetlistCard';
import { EmptyState } from '../components/EmptyState';
import type { SetlistListItem } from '../types';

interface SetlistsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function SetlistsView({ navigate }: SetlistsViewProps) {
  const apiCall = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const [setlists, setSetlists] = useState<SetlistListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDates, setShowDates] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const params: string[] = [];
    if (query) params.push(`q=${encodeURIComponent(query)}`);
    if (dateFrom) params.push(`date_from=${encodeURIComponent(dateFrom)}`);
    if (dateTo) params.push(`date_to=${encodeURIComponent(dateTo)}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    try {
      const data = await apiCall<SetlistListItem[]>('GET', `/api/setlists${qs}`);
      setSetlists(data);
      setLoaded(true);
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => { if (showNew && nameRef.current) nameRef.current.focus(); }, [showNew]);

  const create = async () => {
    if (!newName.trim()) { toast(t('setlist.nameRequired'), 'error'); return; }
    try {
      const result = await apiCall<{ id: number }>('POST', '/api/setlists', { name: newName.trim() });
      toast(t('setlist.created'), 'success');
      navigate('setlist-edit', { id: String(result.id) });
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <>
      <div className="view-header">
        <h2 className="view-title">{t('setlist.title')}</h2>
        <button className="btn btn-sm" onClick={() => setShowNew(true)}>{t('setlist.newSetlist')}</button>
      </div>
      <div className="setlist-tabs">
        <button className="setlist-tab active">My Setlists</button>
        <button className="setlist-tab" onClick={() => navigate('public-setlists')}>Public Setlists</button>
      </div>
      {showNew && (
        <div className="search-row" style={{ marginBottom: 16 }}>
          <input
            ref={nameRef}
            type="text"
            placeholder={t('setlist.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          />
          <button className="btn btn-sm" onClick={create}>{t('setlist.create')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>{t('songEdit.cancel')}</button>
        </div>
      )}
      <div className="search-row">
        <input
          type="search"
          placeholder={t('setlist.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => setShowDates((v) => !v)}>&#128197; Date</button>
        <button className="btn btn-ghost btn-sm" onClick={load}>{t('songs.search')}</button>
      </div>
      {showDates && (
        <div className="search-row" style={{ marginTop: -10 }}>
          <label style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <label style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      )}
      <div className="song-grid">
        {loaded && setlists.length === 0 ? (
          <EmptyState icon="&#127926;" text={t('setlist.noSetlists')} />
        ) : (
          setlists.map((sl) => (
            <SetlistCard
              key={sl.id}
              setlist={sl}
              onClick={() => navigate('setlist-edit', { id: String(sl.id) })}
              onPlay={() => navigate('setlist-play', { id: String(sl.id) })}
            />
          ))
        )}
      </div>
    </>
  );
}
