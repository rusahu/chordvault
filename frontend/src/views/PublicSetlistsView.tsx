import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { SetlistCard } from '../components/SetlistCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async (q = '', from = '', to = '', targetPage = 1) => {
    const params: string[] = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (from) params.push(`date_from=${encodeURIComponent(from)}`);
    if (to) params.push(`date_to=${encodeURIComponent(to)}`);
    params.push(`page=${targetPage}`);
    params.push(`limit=20`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    try {
      interface PaginatedSetlistsResponse {
        setlists: SetlistListItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }
      const data = await apiCall<PaginatedSetlistsResponse>('GET', `/api/setlists/public${qs}`);
      setSetlists(data.setlists);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setLoaded(true);
    } catch (e) { toast((e as Error).message, 'error'); }
  }, [apiCall, toast]);

  useEffect(() => { load('', '', '', 1); }, [load]);

  const handleSearch = () => load(query, dateFrom, dateTo, 1);

  const handlePageChange = (newPage: number) => {
    load(query, dateFrom, dateTo, newPage);
    window.scrollTo(0, 0);
  };

  const showSearch = !loaded || setlists.length > 0 || page > 1;

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
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDates((v) => !v)}>&#128197; Date</button>
            <button className="btn btn-ghost btn-sm" onClick={handleSearch}>{t('songs.search')}</button>
          </div>
          {showDates && (
            <div className="search-row" style={{ marginTop: -10 }}>
              <label style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); load(query, e.target.value, dateTo, 1); }} />
              <label style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>To</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); load(query, dateFrom, e.target.value, 1); }} />
            </div>
          )}
        </>
      )}
      {loaded && setlists.length === 0 ? (
        <EmptyState icon="&#128269;" text={t('setlist.noPublicSetlists')} />
      ) : (
        <>
          <div className="song-grid">
            {setlists.map((sl) => (
              <SetlistCard
                key={sl.id}
                setlist={sl}
                onClick={() => navigate('setlist-edit', { id: String(sl.id) })}
                showUsername
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </>
  );
}
