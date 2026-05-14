import React from 'react';
import { fontScaleValue } from '../lib/chords';

interface ChordSheetProps {
  html: string;
  twoCol?: boolean;
  fontSize?: number;
  autoFit?: boolean; // Kept for class naming if needed
  renderKey?: number;
}

export function ChordSheet({ html, twoCol, fontSize, autoFit }: ChordSheetProps) {
  // Manual/Legacy Scaling Logic
  const manualScale = fontScaleValue(fontSize || 0);
  
  const style: React.CSSProperties = manualScale ? { '--font-scale': String(manualScale) } as React.CSSProperties : {};

  const cls = `chord-sheet-wrap${twoCol ? ' two-col' : ''}${autoFit ? ' fitted-mode' : ''}`;

  return (
    <div
      className={cls}
      style={style}
    >
      <div id="chord-output" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
