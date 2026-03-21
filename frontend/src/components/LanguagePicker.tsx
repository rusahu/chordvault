import { useState, useRef, useEffect } from 'react';
import { LANGUAGES, languageName } from '../lib/languages';

interface LanguagePickerProps {
  value: string;
  onChange: (code: string) => void;
  preferredLanguages: string[];
}

export function LanguagePicker({ value, onChange, preferredLanguages }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const preferred = LANGUAGES.filter(l => preferredLanguages.includes(l.code));
  const lowerSearch = search.toLowerCase();
  const filtered = LANGUAGES.filter(
    l => !preferredLanguages.includes(l.code) &&
      (l.name.toLowerCase().includes(lowerSearch) || l.code.includes(lowerSearch))
  );

  const select = (code: string) => {
    onChange(code);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="language-picker" ref={ref}>
      <button
        type="button"
        className={`language-picker-trigger${value ? '' : ' placeholder'}`}
        onClick={() => setOpen(!open)}
      >
        {value ? languageName(value) : 'Select language...'}
      </button>
      {open && (
        <div className="language-picker-dropdown">
          <input
            ref={inputRef}
            type="text"
            className="language-picker-search"
            placeholder="Search languages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {preferred.length > 0 && !search && (
            <>
              <div className="language-picker-section">My Languages</div>
              {preferred.map(l => (
                <button
                  key={l.code}
                  type="button"
                  className={`language-picker-option${l.code === value ? ' selected' : ''}`}
                  onClick={() => select(l.code)}
                >
                  {l.name} <span className="language-picker-code">{l.code}</span>
                </button>
              ))}
              <div className="language-picker-divider" />
            </>
          )}
          {(search ? [...LANGUAGES.filter(l =>
            preferredLanguages.includes(l.code) &&
            (l.name.toLowerCase().includes(lowerSearch) || l.code.includes(lowerSearch))
          ), ...filtered] : filtered).map(l => (
            <button
              key={l.code}
              type="button"
              className={`language-picker-option${l.code === value ? ' selected' : ''}`}
              onClick={() => select(l.code)}
            >
              {l.name} <span className="language-picker-code">{l.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
