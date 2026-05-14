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
  onSaveOnline?: () => void;
  onSaveLocal?: () => void;
  onExportPdf?: () => void;
  onToggleSettings?: () => void;
  isModified?: boolean;
  overrides?: { num?: boolean; twoCol?: boolean; font?: boolean };
  settingsActive?: boolean;
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
  onSaveOnline,
  onSaveLocal,
  onExportPdf,
  onToggleSettings,
  isModified,
  overrides,
  settingsActive,
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
          KEY {currentKey || '?'}
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
            title="Auto-fit for this screen (one-time)"
          >
            FIT
          </button>
        )}
        {(onSaveOnline || onSaveLocal) && <span className="toolbar-divider" />}
        {onSaveOnline && (
          <button
            className={`transpose-btn font-btn save-btn${isModified ? ' active' : ''}`}
            onClick={onSaveOnline}
            disabled={!isModified}
            title={isModified ? 'Save changes to cloud' : 'All changes saved to cloud'}
          >
            {isModified ? 'SAVE' : 'CLOUD'}
          </button>
        )}
        {onSaveLocal && (
          <button
            className={`transpose-btn font-btn save-btn${isModified ? ' active' : ''}`}
            onClick={onSaveLocal}
            disabled={!isModified}
            title={isModified ? 'Save overrides to this browser' : 'All overrides synced to browser'}
          >
            {isModified ? 'SYNC' : 'LOCAL'}
          </button>
        )}
        {onExportPdf && (
          <button
            className="transpose-btn font-btn pdf-btn"
            onClick={onExportPdf}
            title="Export as PDF"
          >
            PDF
          </button>
        )}
        {onToggleSettings && (
          <button
            className={`transpose-btn font-btn gear-btn${settingsActive ? ' active' : ''}`}
            onClick={onToggleSettings}
            title="Settings"
          >
            &#9881;
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
