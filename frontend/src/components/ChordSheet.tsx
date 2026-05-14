import React, { useState, useEffect } from 'react';
import useFitText from 'use-fit-text';
import { fontScaleValue } from '../lib/chords';

interface ChordSheetProps {
  html: string;
  twoCol?: boolean;
  fontSize?: number;
  autoFit?: boolean;
  renderKey?: number;
}

export function ChordSheet({ html, twoCol, fontSize, autoFit, renderKey }: ChordSheetProps) {
  const [autoTwoCol, setAutoTwoCol] = useState(false);
  const [isFitting, setIsFitting] = useState(false);

  // Reset states when content or mode changes
  useEffect(() => {
    setAutoTwoCol(false);
    if (autoFit) setIsFitting(true);
  }, [html, autoFit, twoCol, renderKey]);

  const { fontSize: fitFontSize, ref } = useFitText({
    minFontSize: 40,
    maxFontSize: 100, // Never grow larger than standard
    onStart: () => setIsFitting(true),
    onFinish: () => {
      // Small delay to ensure browser has painted the final size before showing
      setTimeout(() => setIsFitting(false), 50);
    }
  });

  // Smart Fallback: If font has to shrink too much, try 2-column
  useEffect(() => {
    if (!autoFit) return;
    const size = parseInt(fitFontSize);
    const isMobile = window.innerWidth < 900;

    // Only try 2-column fallback if:
    // 1. Font is too small (<= 65%)
    // 2. We aren't already in 2-column mode
    // 3. We are NOT on a mobile/narrow screen
    if (size <= 65 && !autoTwoCol && !twoCol && !isMobile) {
      setAutoTwoCol(true);
      setIsFitting(true);
    }
  }, [fitFontSize, autoFit, autoTwoCol, twoCol]);

  // Manual/Legacy Scaling Logic
  const manualScale = fontScaleValue(fontSize || 0);
  
  // Decide which styling strategy to use:
  const style: React.CSSProperties = autoFit 
    ? { 
        fontSize: fitFontSize, 
        opacity: isFitting ? 0 : 1, 
        transition: isFitting ? 'none' : 'opacity 0.25s ease-out' 
      } 
    : (manualScale ? { '--font-scale': String(manualScale) } as any : {});

  const isTwoCol = twoCol || (autoFit && autoTwoCol);
  const cls = `chord-sheet-wrap${isTwoCol ? ' two-col' : ''}${autoFit ? ' fitted-mode' : ''}`;

  return (
    <div
      ref={ref}
      className={cls}
      style={style}
    >
      {autoFit && isFitting && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          opacity: 1
        }}>
          <div className="spinner" style={{ width: 30, height: 30, border: '3px solid var(--muted)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'cv-spin 1s linear infinite' }}></div>
          <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>Fitting...</div>
        </div>
      )}
      <div id="chord-output" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}