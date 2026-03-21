import { ALL_KEYS, ALL_KEYS_MINOR, normalizeKey } from '../lib/keys';

interface KeyPickerProps {
  currentKey: string;
  onPickKey: (key: string) => void;
  visible: boolean;
}

export function KeyPicker({ currentKey, onPickKey, visible }: KeyPickerProps) {
  if (!visible) return null;

  const norm = normalizeKey(currentKey);
  const isMinor = norm && norm.endsWith('m') && norm.length > 1;
  const keys = isMinor ? ALL_KEYS_MINOR : ALL_KEYS;

  return (
    <div className="key-picker" id="key-picker">
      {keys.map((k) => (
        <button
          key={k}
          className={`key-pill${k === norm ? ' active' : ''}`}
          onClick={() => onPickKey(k)}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
