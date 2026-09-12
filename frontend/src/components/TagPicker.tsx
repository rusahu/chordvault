import { useState } from 'react';

interface TagPickerProps {
  selected: string[];
  suggestions?: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ selected, suggestions = [], onChange }: TagPickerProps) {
  const [input, setInput] = useState('');
  const hasTag = (tag: string) => selected.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase());
  const add = (raw: string) => {
    const tag = raw.trim();
    if (!tag || hasTag(tag)) return;
    onChange([...selected, tag]);
    setInput('');
  };
  const addMany = (raw: string) => {
    const next = [...selected];
    for (const part of raw.split(',')) {
      const tag = part.trim();
      if (tag && !next.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) next.push(tag);
    }
    if (next.length !== selected.length) onChange(next);
    setInput('');
  };
  const remove = (tag: string) => onChange(selected.filter((item) => item.toLocaleLowerCase() !== tag.toLocaleLowerCase()));
  const available = suggestions.filter((tag) => !hasTag(tag));

  return (
    <div className="tag-picker" id="tag-picker">
      <div className="tag-selected">
        {selected.map((tag) => (
          <button key={tag} type="button" className="tag-pill active" onClick={() => remove(tag)} aria-label={`Remove ${tag}`}>
            {tag} <span aria-hidden="true">&times;</span>
          </button>
        ))}
        <input
          className="tag-input"
          value={input}
          placeholder="Add a tag…"
          list="song-tag-suggestions"
          onChange={(event) => {
            const value = event.target.value;
            if (value.includes(',')) {
              addMany(value);
            } else setInput(value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add(input);
            }
          }}
          onBlur={() => add(input)}
        />
        <datalist id="song-tag-suggestions">
          {available.map((tag) => <option key={tag} value={tag} />)}
        </datalist>
      </div>
      {available.map((tag) => (
        <button
          key={tag}
          type="button"
          className="tag-pill"
          onClick={() => add(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
