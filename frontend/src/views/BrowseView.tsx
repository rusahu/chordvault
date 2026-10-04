import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { SongCard } from '../components/SongCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { MultiTagSelect } from '../components/MultiTagSelect';
import type { SongListItem } from '../types';
import { LANGUAGES } from '../lib/languages';
import { getSessionItem, setSessionItem } from '../lib/storage';

interface BrowseViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function BrowseView({ navigate }: BrowseViewProps) {
  const api = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [query, setQuery] = useState(() => getSessionItem('cv_browse_query') || '');
  const [langFilter, setLangFilter] = useState(() => getSessionItem('cv_browse_lang') || '');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(getSessionItem('cv_browse_tags') || '[]');
      return Array.isArray(stored) ? stored.filter((tag): tag is string => typeof tag === 'string') : [];
    } catch { return []; }
  });
  const [showFilters, setShowFilters] = useState(() => getSessionItem('cv_browse_show_filters') === 'true');
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(() => {
    const saved = getSessionItem('cv_browse_page');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async (q = '', lang = '', tags: string[] = [], targetPage = 1) => {
    try {
      let url = '/api/songs/public';
      const params: string[] = [];
      if (q) params.push(`q=${encodeURIComponent(q)}`);
      if (lang) params.push(`language=${encodeURIComponent(lang)}`);
      tags.forEach((tag) => params.push(`tags=${encodeURIComponent(tag)}`));
      params.push(`page=${targetPage}`);
      params.push(`limit=20`);
      url += '?' + params.join('&');
      
      interface PaginatedSongsResponse {
        songs: SongListItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }
      const data = await api<PaginatedSongsResponse>('GET', url);
      setSongs(data.songs);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setLoaded(true);
      
      setSessionItem('cv_browse_query', q);
      setSessionItem('cv_browse_lang', lang);
      setSessionItem('cv_browse_tags', JSON.stringify(tags));
      setSessionItem('cv_browse_page', String(data.page));
    } catch (e) { toast((e as Error).message, 'error'); }
  }, [api, toast]);

  useEffect(() => {
    load(query, langFilter, selectedTags, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    api<{ tags: string[] }>('GET', '/api/songs/public/tags')
      .then((data) => setAvailableTags(data.tags))
      .catch((e) => toast(e.message, 'error'));
  }, [api, toast]);

  const handleClear = () => {
    setQuery('');
    load('', langFilter, selectedTags, 1);
  };

  const doSearch = () => load(query, langFilter, selectedTags, 1);

  const handlePageChange = (newPage: number) => {
    load(query, langFilter, selectedTags, newPage);
    window.scrollTo(0, 0);
  };

  const changeTags = (tags: string[]) => {
    setSelectedTags(tags);
    load(query, langFilter, tags, 1);
  };

  const showHero = !user && !query && !langFilter && !selectedTags.length && loaded && songs.length === 0 && page === 1;

  return (
    <>
      {showHero ? (
        <div className="hero">
          <div className="hero-title">&#9833; ChordVault</div>
          <div className="hero-tagline">{t('hero.tagline')}</div>
          <div className="hero-cta">{t('hero.cta')}</div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn" onClick={() => navigate('auth')}>{t('auth.signIn')}</button>
            <button className="btn btn-ghost" onClick={() => navigate('about')}>Learn more</button>
          </div>
        </div>
      ) : (
        <>
          <div className="search-row">
            <div className="search-input-wrapper">
              <input
                type="search"
                placeholder={t('songs.searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
              />
              {query && (
                <button
                  className="search-clear-btn"
                  onClick={handleClear}
                  title="Clear search"
                >
                  &times;
                </button>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={doSearch}>{t('songs.search')}</button>
            <button
              className={`btn btn-ghost btn-sm${showFilters || langFilter || selectedTags.length ? ' active' : ''}`}
              onClick={() => {
                const next = !showFilters;
                setShowFilters(next);
                setSessionItem('cv_browse_show_filters', String(next));
              }}
              title="Filters"
            >
              &#9776;
            </button>
            {user && (
              <button className="btn btn-sm" onClick={() => navigate('song-edit')}>&#43; New Song</button>
            )}
          </div>
          {showFilters && (
            <div className="search-filters">
              <select
                className="language-filter"
                value={langFilter}
                onChange={(e) => { setLangFilter(e.target.value); load(query, e.target.value, selectedTags, 1); }}
              >
                <option value="">All languages</option>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
              <MultiTagSelect options={availableTags} selected={selectedTags} onChange={changeTags} />
            </div>
          )}
          <div className="song-grid">
            {loaded && songs.length === 0 ? (
              <EmptyState icon="&#128269;" text={t('songs.noPublicSongs')} />
            ) : (
              songs.map((s) => (
                <SongCard
                  key={s.id}
                  song={s}
                  isOwner={user?.username === s.username}
                  onClick={() => navigate('song-view', { id: String(s.id) })}
                  onEdit={() => navigate('song-edit', { id: String(s.id) })}
                />
              ))
            )}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </>
  );
}
