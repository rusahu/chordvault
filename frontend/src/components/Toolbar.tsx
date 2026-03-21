import { useState } from 'react';
import { KeyPicker } from './KeyPicker';

interface ToolbarProps {
  currentKey: string;
  nashville: boolean;
  nashvilleDisabled?: boolean;
  onNashvilleChange: (checked: boolean) => void;
  twoCol: boolean;
  onTwoColToggle: () => void;
  fontSize: number;
  onFontChange: (delta: number) => void;
  onFontReset: () => void;
  onPickKey: (key: string) => void;
  onAutoFit?: () => void;
  overrides?: { num?: boolean; twoCol?: boolean; font?: boolean };
}

export function Toolbar({
  currentKey,
  nashville,
  nashvilleDisabled,
  onNashvilleChange,
  twoCol,
  onTwoColToggle,
  fontSize,
  onFontChange,
  onFontReset,
  onPickKey,
  onAutoFit,
  overrides,
}: ToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ov = overrides || {};

  return (
    <>
      <div className="transpose-bar">
        <button
          className={`key-current${nashville ? ' disabled' : ''}`}
          id="key-display"
          onClick={() => setPickerOpen((v) => !v)}
        >
          {currentKey || '?'}
        </button>
        <label className={`number-toggle${ov.num ? ' overridden' : ''}`} id="nashville-toggle">
          <input
            type="checkbox"
            checked={nashville}
            disabled={nashvilleDisabled}
            onChange={(e) => onNashvilleChange(e.target.checked)}
          />
          <span>Num</span>
        </label>
        <button
          className={`transpose-btn col-toggle${twoCol ? ' active' : ''}${ov.twoCol ? ' overridden' : ''}`}
          onClick={onTwoColToggle}
          title={twoCol ? 'Switch to 1 column' : 'Switch to 2 columns'}
        >
          {twoCol ? '2col' : '1col'}
        </button>
        <span className="toolbar-divider" />
        <button
          className={`transpose-btn font-btn${ov.font ? ' overridden' : ''}`}
          onClick={() => onFontChange(-1)}
        >
          A&#8722;
        </button>
        <button
          className={`transpose-btn font-btn${ov.font ? ' overridden' : ''}`}
          onClick={() => onFontChange(1)}
        >
          A+
        </button>
        <button
          className="transpose-btn font-btn font-reset"
          onClick={onFontReset}
          disabled={fontSize === 0}
        >
          &#8634;
        </button>
        {onAutoFit && (
          <>
            <span className="toolbar-divider" />
            <button
              className="transpose-btn font-btn autofit-btn"
              onClick={onAutoFit}
              title="Auto-fit: adjust font and columns for this screen"
            >
              Fit
            </button>
          </>
        )}
      </div>
      <KeyPicker
        currentKey={currentKey}
        onPickKey={onPickKey}
        visible={pickerOpen}
      />
    </>
  );
}
