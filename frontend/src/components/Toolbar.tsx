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
  onReset: () => void;
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
  onReset,
  onPickKey,
  onAutoFit,
  overrides,
}: ToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ov = overrides || {};
  const isDefault = fontSize === 0 && !twoCol;

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
          title={twoCol ? 'Single column' : 'Multi-column'}
        >
          Col
        </button>
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
        <span className="toolbar-divider" />
        {onAutoFit && (
          <button
            className="transpose-btn font-btn autofit-btn"
            onClick={onAutoFit}
            title="Auto-fit: adjust font and columns for this screen"
          >
            Fit
          </button>
        )}
        <button
          className="transpose-btn font-btn font-reset"
          onClick={onReset}
          disabled={isDefault}
          title="Reset font and columns"
        >
          &#8634;
        </button>
      </div>
      <KeyPicker
        currentKey={currentKey}
        onPickKey={onPickKey}
        visible={pickerOpen}
      />
    </>
  );
}
