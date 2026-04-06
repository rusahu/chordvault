import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { SetlistCard } from '../components/SetlistCard';
import { EmptyState } from '../components/EmptyState';
import type { SetlistListItem } from '../types';

interface PublicSetlistsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function PublicSetlistsView({ navigate }: PublicSetlistsViewProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [setlists, setSetlists] = useState<SetlistListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDates, setShowDates] = useState(false);

  const load = useCallback(async (q = '', from = '', to = '') => {
    const params: string[] = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (from) params.push(`date_from=${encodeURIComponent(from)}`);
    if (to) params.push(`date_to=${encodeURIComponent(to)}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    try {
      const data = await apiCall<SetlistListItem[]>('GET', `/api/setlists/public${qs}`);
      setSetlists(data);
      setLoaded(true);
    } catch (e) { toast((e as Error).message, 'error'); }
  }, [apiCall, toast]);

  useEffect(() => { load(); }, [load]);

  const showSearch = !loaded || setlists.length > 0;

  return (
    <>
      <div className="view-header">
        <h2 className="view-title">{t('setlist.browseSetlists')}</h2>
      </div>
      <div className="setlist-tabs">
        {user ? (
          <button className="setlist-tab" onClick={() => navigate('setlists')}>My Setlists</button>
        ) : (
          <button className="setlist-tab" onClick={() => navigate('local-setlists')}>My Setlists</button>
        )}
        <button className="setlist-tab active">Public Setlists</button>
      </div>
      {showSearch && (
        <>
          <div className="search-row">
            <input
              type="search"
              placeholder={t('setlist.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(query, dateFrom, dateTo); }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDates((v) => !v)}>&#128197; Date</button>
            <button className="btn btn-ghost btn-sm" onClick={() => load(query, dateFrom, dateTo)}>{t('songs.search')}</button>
          </div>
          {showDates && (
            <div className="search-row" style={{ marginTop: -10 }}>
              <label style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <label style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          )}
        </>
      )}
      {loaded && setlists.length === 0 ? (
        <EmptyState icon="&#128269;" text={t('setlist.noPublicSetlists')} />
      ) : (
        <div className="song-grid">
          {setlists.map((sl) => (
            <SetlistCard
              key={sl.id}
              setlist={sl}
              onClick={() => navigate('setlist-play', { id: String(sl.id), public: '1' })}
              showUsername
            />
          ))}
        </div>
      )}
    </>
  );
}
