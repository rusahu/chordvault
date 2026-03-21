import { PRESET_TAGS } from '../lib/constants';

interface TagPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ selected, onChange }: TagPickerProps) {
  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  return (
    <div className="tag-picker" id="tag-picker">
      {PRESET_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          className={`tag-pill${selected.includes(tag) ? ' active' : ''}`}
          onClick={() => toggle(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
