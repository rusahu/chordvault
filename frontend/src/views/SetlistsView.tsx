import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useLocalSetlists } from '../hooks/useLocalSetlists';
import { SetlistCard } from '../components/SetlistCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import type { SetlistListItem } from '../types';

interface SetlistsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
  initialTab?: string;
}

export function SetlistsView({ navigate, initialTab }: SetlistsViewProps) {
  const apiCall = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const ls = useLocalSetlists();

  const [activeTab, setActiveTab] = useState<'cloud' | 'local'>(() => {
    if (initialTab === 'local' || !user) return 'local';
    return 'cloud';
  });

  const [setlists, setSetlists] = useState<SetlistListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDates, setShowDates] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const nameRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q = '', from = '', to = '', targetPage = 1) => {
    if (!user) return;
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
      const data = await apiCall<PaginatedSetlistsResponse>('GET', `/api/setlists${qs}`);
      setSetlists(data.setlists);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setLoaded(true);
    } catch (e) { toast((e as Error).message, 'error'); }
  }, [apiCall, toast, user]);

  useEffect(() => {
    if (activeTab === 'cloud') {
      load('', '', '', 1);
    } else {
      setLoaded(true);
    }
  }, [load, activeTab]);

  useEffect(() => { if (showNew && nameRef.current) nameRef.current.focus(); }, [showNew]);

  const create = async () => {
    if (!newName.trim()) { toast(t('setlist.nameRequired'), 'error'); return; }
    if (newName.length > 200) { toast('Name too long', 'error'); return; }

    if (activeTab === 'local') {
      const sl = ls.create(newName.trim());
      if (!sl) { toast('Max 50 setlists', 'error'); return; }
      toast(t('setlist.created'), 'success');
      navigate('setlist-edit', { id: sl.id });
    } else {
      try {
        const result = await apiCall<{ id: number }>('POST', '/api/setlists', { name: newName.trim() });
        toast(t('setlist.created'), 'success');
        navigate('setlist-edit', { id: String(result.id) });
      } catch (e) { toast((e as Error).message, 'error'); }
    }
  };

  const handleSearch = () => {
    if (activeTab === 'cloud') {
      load(query, dateFrom, dateTo, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (activeTab === 'cloud') {
      load(query, dateFrom, dateTo, newPage);
      window.scrollTo(0, 0);
    }
  };

  const localSetlistsToRender = query.trim()
    ? ls.setlists.filter(sl => sl.name.toLowerCase().includes(query.toLowerCase()))
    : ls.setlists;

  return (
    <>
      <div className="view-header">
        <h2 className="view-title">{t('setlist.title')}</h2>
        <button className="btn btn-sm" onClick={() => setShowNew(true)}>{t('setlist.newSetlist')}</button>
      </div>
      <div className="setlist-tabs">
        {user && (
          <button
            className={`setlist-tab${activeTab === 'cloud' ? ' active' : ''}`}
            onClick={() => { setActiveTab('cloud'); setQuery(''); }}
          >
            Cloud Setlists
          </button>
        )}
        <button
          className={`setlist-tab${activeTab === 'local' ? ' active' : ''}`}
          onClick={() => { setActiveTab('local'); setQuery(''); }}
        >
          Local Setlists
        </button>
        <button className="setlist-tab" onClick={() => navigate('public-setlists')}>Public Setlists</button>
      </div>
      {activeTab === 'local' && !user && (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
          These setlists are saved in your browser. Sign in to create server-synced setlists.
        </p>
      )}
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
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
        />
        {activeTab === 'cloud' && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowDates((v) => !v)}>&#128197; Date</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={handleSearch}>{t('songs.search')}</button>
      </div>
      {activeTab === 'cloud' && showDates && (
        <div className="search-row" style={{ marginTop: -10 }}>
          <label style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <label style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      )}
      <div className="song-grid">
        {loaded && (
          activeTab === 'cloud' ? (
            setlists.length === 0 ? (
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
            )
          ) : (
            localSetlistsToRender.length === 0 ? (
              <EmptyState icon="&#127926;" text={t('setlist.noSetlists')} />
            ) : (
              localSetlistsToRender.map((sl) => (
                <SetlistCard
                  key={sl.id}
                  setlist={{
                    id: sl.id,
                    name: sl.name,
                    visibility: 'private',
                    song_count: sl.entries.length,
                    event_date: null,
                  }}
                  onClick={() => navigate('setlist-edit', { id: sl.id })}
                  onPlay={() => navigate('setlist-play', { id: sl.id, local: '1' })}
                />
              ))
            )
          )
        )}
      </div>
      {activeTab === 'cloud' && (
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </>
  );
}
