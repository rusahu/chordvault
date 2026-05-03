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
  autoFitActive?: boolean;
  onSave?: () => void;
  isModified?: boolean;
  saveLabel?: string;
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
  autoFitActive,
  onSave,
  isModified,
  saveLabel,
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
          Key {currentKey || '?'}
        </button>
        <label className={`number-toggle${ov.num ? ' overridden' : ''}`} id="nashville-toggle">
          <input
            type="checkbox"
            checked={nashville}
            disabled={nashvilleDisabled}
            onChange={(e) => onNashvilleChange(e.target.checked)}
          />
          <span>123</span>
        </label>
        <button
          className={`transpose-btn col-toggle${twoCol ? ' active' : ''}${ov.twoCol ? ' overridden' : ''}`}
          onClick={onTwoColToggle}
          title={twoCol ? 'Single column' : 'Multi-column'}
        >
          &#124;&#124;
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
            className={`transpose-btn font-btn autofit-btn${autoFitActive ? ' active' : ''}`}
            onClick={onAutoFit}
            title={autoFitActive ? 'Auto-fit: ON (click to turn off)' : 'Auto-fit: adjust font and columns for this screen'}
          >
            Fit
          </button>
        )}
        {onSave && (
          <button
            className={`transpose-btn font-btn save-btn${isModified ? ' active' : ''}`}
            onClick={onSave}
            disabled={!isModified}
            title={isModified ? saveLabel : 'All changes saved'}
          >
            {isModified ? (saveLabel || 'Save') : 'Saved'}
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
