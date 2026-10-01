import { useEffect, useRef, useState } from 'react';

interface MultiTagSelectProps {
  options: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function MultiTagSelect({ options, selected, onChange }: MultiTagSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const isSelected = (tag: string) => selected.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase());
  const toggle = (tag: string) => {
    const next = isSelected(tag)
      ? selected.filter((item) => item.toLocaleLowerCase() !== tag.toLocaleLowerCase())
      : [...selected, tag];
    onChange(next);
  };

  return (
    <div className="multi-tag-select" ref={ref}>
      <button
        type="button"
        className={`multi-tag-trigger${selected.length ? ' active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {selected.length ? `Tags (${selected.length})` : 'All tags'}
        <span aria-hidden="true">&#9662;</span>
      </button>
      {open && (
        <div className="multi-tag-dropdown">
          {options.length === 0 ? (
            <div className="multi-tag-empty">No tags available</div>
          ) : (
            options.map((tag) => (
              <label key={tag} className="multi-tag-option">
                <input type="checkbox" checked={isSelected(tag)} onChange={() => toggle(tag)} />
                <span>{tag}</span>
              </label>
            ))
          )}
          {selected.length > 0 && (
            <button type="button" className="multi-tag-clear" onClick={() => onChange([])}>
              Clear tags
            </button>
          )}
        </div>
      )}
    </div>
  );
}
