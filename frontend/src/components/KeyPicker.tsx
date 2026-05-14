import { normalizeKey, ALL_KEYS, ALL_KEYS_MINOR } from '../lib/keys';

interface KeyPickerProps {
  currentKey: string;
  onPickKey: (key: string) => void;
  visible: boolean;
  isModified?: boolean;
  onSaveOnline?: () => void;
  onSaveLocal?: () => void;
}

export function KeyPicker({ 
  currentKey, 
  onPickKey, 
  visible, 
  isModified, 
  onSaveOnline, 
  onSaveLocal 
}: KeyPickerProps) {
  if (!visible) return null;

  const norm = normalizeKey(currentKey);
  const isMinor = norm && norm.endsWith('m') && norm.length > 1;
  const keys = isMinor ? ALL_KEYS_MINOR : ALL_KEYS;

  return (
    <div className="key-picker" id="key-picker">
      <div className="key-grid">
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
      {isModified && (
        <div className="key-picker-actions">
          <div className="key-picker-save-hint">Save this key?</div>
          <div className="key-picker-btns">
            {onSaveOnline && (
              <button className="btn btn-sm btn-save-online" onClick={onSaveOnline}>
                SAVE (Online)
              </button>
            )}
            {onSaveLocal && (
              <button className="btn btn-sm btn-ghost" onClick={onSaveLocal}>
                Save (Local)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
