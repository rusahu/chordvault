import React, { useState, useEffect } from 'react';
import useFitText from 'use-fit-text';
import { fontScaleValue } from '../lib/chords';

interface ChordSheetProps {
  html: string;
  twoCol?: boolean;
  fontSize?: number;
  autoFit?: boolean;
}

export function ChordSheet({ html, twoCol, fontSize, autoFit }: ChordSheetProps) {
  // 1. Library Fit Logic (The professional fix)
  const [autoTwoCol, setAutoTwoCol] = useState(false);

  // Reset autoTwoCol when content or mode changes
  useEffect(() => {
    setAutoTwoCol(false);
  }, [html, autoFit]);

  const { fontSize: fitFontSize, ref } = useFitText({
    minFontSize: 40,
    maxFontSize: 100, // Never grow larger than standard
  });

  // Smart Fallback: If font has to shrink too much, try 2-column
  useEffect(() => {
    if (!autoFit) return;
    const size = parseInt(fitFontSize);
    if (size <= 65 && !autoTwoCol && !twoCol) {
      setAutoTwoCol(true);
    }
  }, [fitFontSize, autoFit, autoTwoCol, twoCol]);

  // 2. Manual/Legacy Scaling Logic
  const manualScale = fontScaleValue(fontSize || 0);
  
  // Decide which styling strategy to use:
  const style: React.CSSProperties = autoFit 
    ? { fontSize: fitFontSize } 
    : (manualScale ? { '--font-scale': String(manualScale) } as any : {});

  const isTwoCol = twoCol || (autoFit && autoTwoCol);
  const cls = `chord-sheet-wrap${isTwoCol ? ' two-col' : ''}${autoFit ? ' fitted-mode' : ''}`;

  return (
    <div
      ref={ref}
      className={cls}
      style={style}
    >
      <div id="chord-output" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}