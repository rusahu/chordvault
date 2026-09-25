import React from 'react';
import { fontScaleValue } from '../lib/chords';

interface ChordSheetProps {
  html: string;
  twoCol?: boolean;
  fontSize?: number;
}

export function ChordSheet({ html, twoCol, fontSize }: ChordSheetProps) {
  // Manual/Legacy Scaling Logic
  const manualScale = fontScaleValue(fontSize || 0);
  
  const style: React.CSSProperties = manualScale ? { '--font-scale': String(manualScale) } as React.CSSProperties : {};

  const cls = `chord-sheet-wrap${twoCol ? ' two-col' : ''}`;

  return (
    <div
      className={cls}
      style={style}
    >
      <div id="chord-output" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
