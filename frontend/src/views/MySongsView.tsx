import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { SongCard } from '../components/SongCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { MultiTagSelect } from '../components/MultiTagSelect';
import type { SongListItem } from '../types';
import { getSessionItem, setSessionItem } from '../lib/storage';
import { LANGUAGES } from '../lib/languages';

interface MySongsViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function MySongsView({ navigate }: MySongsViewProps) {
  const api = useApi();
  const { t } = useI18n();
  const toast = useToast();
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [query, setQuery] = useState(() => getSessionItem('cv_mysongs_query') || '');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [langFilter, setLangFilter] = useState(() => getSessionItem('cv_mysongs_lang') || '');
  const [showFilters, setShowFilters] = useState(() => getSessionItem('cv_mysongs_show_filters') === 'true');
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(getSessionItem('cv_mysongs_tags') || '[]');
      return Array.isArray(stored) ? stored.filter((tag): tag is string => typeof tag === 'string') : [];
    } catch { return []; }
  });
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(() => {
    const saved = getSessionItem('cv_mysongs_page');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback((q = '', targetPage = 1, tagFilters: string[] = [], language = '') => {
    let url = '/api/songs';
    const params: string[] = [];
    if (q.trim()) params.push(`q=${encodeURIComponent(q.trim())}`);
    if (language) params.push(`language=${encodeURIComponent(language)}`);
    tagFilters.forEach((tag) => params.push(`tags=${encodeURIComponent(tag)}`));
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

    api<PaginatedSongsResponse>('GET', url)
      .then((data) => {
        setSongs(data.songs);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setLoaded(true);
        setSessionItem('cv_mysongs_query', q);
        setSessionItem('cv_mysongs_page', String(data.page));
        setSessionItem('cv_mysongs_tags', JSON.stringify(tagFilters));
        setSessionItem('cv_mysongs_lang', language);
      })
      .catch((e) => toast(e.message, 'error'));
  }, [api, toast]);

  useEffect(() => {
    load(query, page, selectedTags, langFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    api<{ tags: string[] }>('GET', '/api/songs/tags')
      .then((data) => setAvailableTags(data.tags))
      .catch((e) => toast(e.message, 'error'));
  }, [api, toast]);

  const handleClear = () => {
    setQuery('');
    load('', 1, selectedTags, langFilter);
  };

  const doSearch = () => load(query, 1, selectedTags, langFilter);

  const handlePageChange = (newPage: number) => {
    load(query, newPage, selectedTags, langFilter);
    window.scrollTo(0, 0);
  };

  const toggleTag = (tag: string) => {
    const selected = selectedTags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase());
    const next = selected
      ? selectedTags.filter((item) => item.toLocaleLowerCase() !== tag.toLocaleLowerCase())
      : [...selectedTags, tag];
    setSelectedTags(next);
    setPage(1);
    load(query, 1, next, langFilter);
  };

  const clearTags = () => {
    setSelectedTags([]);
    setPage(1);
    load(query, 1, [], langFilter);
  };

  const changeLanguage = (language: string) => {
    setLangFilter(language);
    setPage(1);
    load(query, 1, selectedTags, language);
  };

  return (
    <>
      <div className="view-header">
        <h2 className="view-title">{t('songs.mySongs')}</h2>
      </div>
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
            setSessionItem('cv_mysongs_show_filters', String(next));
          }}
          title="Filters"
        >
          &#9776;
        </button>
        <button className="btn btn-sm" onClick={() => navigate('song-edit')}>{t('songs.newSong')}</button>
      </div>
      {showFilters && (
        <div className="search-filters">
          <select className="language-filter" value={langFilter} onChange={(event) => changeLanguage(event.target.value)}>
            <option value="">All languages</option>
            {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
          <MultiTagSelect options={availableTags} selected={selectedTags} onChange={(tags) => {
            setSelectedTags(tags);
            setPage(1);
            load(query, 1, tags, langFilter);
          }} />
        </div>
      )}
      {availableTags.length > 0 && (
        <div className="library-tag-filters" aria-label="Filter songs by tag">
          {availableTags.map((tag) => {
            const active = selectedTags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase());
            return (
              <button key={tag} type="button" className={`tag-pill${active ? ' active' : ''}`} aria-pressed={active} onClick={() => toggleTag(tag)}>
                {tag}
              </button>
            );
          })}
          {selectedTags.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={clearTags}>Clear tags</button>}
        </div>
      )}
      <div className="song-grid">
        {loaded && songs.length === 0 ? (
          <EmptyState
            icon="&#127928;"
            text={query || selectedTags.length ? t('songs.noMatches') : t('songs.noSongs')}
            action={!query && !selectedTags.length ? { label: t('songs.addFirst'), onClick: () => navigate('song-edit') } : undefined}
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
      <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
    </>
  );
}
