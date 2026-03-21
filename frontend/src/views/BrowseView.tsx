import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { SongCard } from '../components/SongCard';
import { EmptyState } from '../components/EmptyState';
import type { SongListItem } from '../types';
import { LANGUAGES } from '../lib/languages';

interface BrowseViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function BrowseView({ navigate }: BrowseViewProps) {
  const api = useApi();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [query, setQuery] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async (q = '', lang = '') => {
    try {
      let url = '/api/songs/public';
      const params: string[] = [];
      if (q) params.push(`q=${encodeURIComponent(q)}`);
      if (lang) params.push(`language=${encodeURIComponent(lang)}`);
      if (params.length) url += '?' + params.join('&');
      const data = await api<SongListItem[]>('GET', url);
      setSongs(data);
      setLoaded(true);
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  useEffect(() => { load(); }, []);

  const doSearch = () => load(query, langFilter);

  const showHero = !user && !query && !langFilter && loaded && songs.length === 0;

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
            <input
              type="search"
              placeholder={t('songs.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
            />
            <button className="btn btn-ghost btn-sm" onClick={doSearch}>{t('songs.search')}</button>
            <button
              className={`btn btn-ghost btn-sm${showFilters || langFilter ? ' active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
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
                onChange={(e) => { setLangFilter(e.target.value); load(query, e.target.value); }}
              >
                <option value="">All languages</option>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
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
        </>
      )}
    </>
  );
}
