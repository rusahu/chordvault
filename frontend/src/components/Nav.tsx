import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logoSvg from '../assets/logo.svg?raw';

interface NavProps {
  view: string;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function Nav({ view, navigate }: NavProps) {
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Use the actual HTML entities from original: ☼ (9788) for dark, ☾ (9790) for light
  const themeIconHtml = theme === 'light' ? '&#9790;' : '&#9788;';

  const songsBtnActive = view === 'browse' ? ' active' : '';
  const setlistBtnActive = ['setlists', 'setlist-edit', 'setlist-play', 'public-setlists', 'local-setlists', 'local-setlist-edit'].includes(view) ? ' active' : '';

  return (
    <nav id="nav">
      <div className="nav-brand" onClick={() => navigate('browse')}><span className="nav-logo" dangerouslySetInnerHTML={{ __html: logoSvg }} /> ChordVault</div>
      <div className="nav-links" id="nav-links">
        <button
          className="nav-btn nav-icon"
          onClick={toggleTheme}
          title="Toggle theme"
          dangerouslySetInnerHTML={{ __html: themeIconHtml }}
        />
        <button
          className={`nav-btn${songsBtnActive}`}
          onClick={() => navigate('browse')}
        >
          Songs
        </button>

        {!user ? (
          <>
            <button
              className={`nav-btn${setlistBtnActive}`}
              onClick={() => navigate('public-setlists')}
            >
              Setlists
            </button>
            <button
              className={`nav-btn nav-signin${view === 'auth' ? ' active' : ''}`}
              onClick={() => navigate('auth')}
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            <button
              className={`nav-btn${setlistBtnActive}`}
              onClick={() => navigate('setlists')}
            >
              Setlists
            </button>
            {isAdmin && (
              <button
                className={`nav-btn${view === 'admin' ? ' active' : ''}`}
                onClick={() => navigate('admin')}
              >
                Admin
              </button>
            )}
            <div className="nav-menu-wrap" ref={menuRef}>
              <button
                className={`nav-btn nav-icon${view === 'settings' || view === 'my-songs' ? ' active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                id="nav-menu-btn"
                title="Menu"
              >
                &#9776;
              </button>
              <div className={`nav-dropdown${menuOpen ? ' open' : ''}`} id="nav-dropdown">
                <button className="nav-dropdown-item" onClick={() => { navigate('my-songs'); setMenuOpen(false); }}>My Songs</button>
                <button className="nav-dropdown-item" onClick={() => { navigate('settings'); setMenuOpen(false); }}>Settings</button>
                <hr className="nav-dropdown-divider" />
                <button className="nav-dropdown-item" onClick={() => { logout(); setMenuOpen(false); navigate('browse'); }}>Sign out</button>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
