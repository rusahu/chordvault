import { useEffect, useRef, useState } from 'react';
import { SVGuitarChord } from 'svguitar';
import type { Chord } from 'svguitar';
import { useI18n } from '../context/I18nContext';
import { guitarChordDiagram } from '../lib/guitar-chords';
import { getChordDiagramsExpanded, setChordDiagramsExpanded } from '../lib/storage';

function Diagram({ symbol, chord }: { symbol: string; chord: Chord }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const styles = getComputedStyle(document.documentElement);
    const text = styles.getPropertyValue('--text').trim() || '#222';
    const accent = styles.getPropertyValue('--accent').trim() || '#7c5cff';
    const chart = new SVGuitarChord(ref.current);
    chart.configure({
      color: text,
      fingerColor: accent,
      fingerTextColor: styles.getPropertyValue('--surface').trim() || '#fff',
      fontFamily: styles.getPropertyValue('--font-sans').trim(),
      frets: 4,
      position: chord.position,
      svgTitle: `Guitar chord diagram for ${symbol}`,
      titleFontSize: 44,
    }).chord(chord).draw();
    return () => chart.remove();
  }, [chord, symbol]);

  return <div className="chord-diagram-svg" ref={ref} />;
}

export function ChordDiagrams({ chords }: { chords: string[] }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(getChordDiagramsExpanded);

  if (chords.length === 0) return null;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    setChordDiagramsExpanded(next);
  };

  return (
    <section className="chord-diagrams">
      <button
        type="button"
        className="chord-diagrams-toggle"
        aria-expanded={expanded}
        aria-controls="song-chord-diagrams"
        onClick={toggle}
      >
        <span>{t('songView.chordsUsed', 'Chords used')} <span className="badge">{chords.length}</span></span>
        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div id="song-chord-diagrams" className="chord-diagrams-grid">
          {chords.map((symbol) => {
            const chord = guitarChordDiagram(symbol);
            return (
              <div className={`chord-diagram-card${chord ? '' : ' unsupported'}`} key={symbol}>
                {chord
                  ? <Diagram symbol={symbol} chord={chord} />
                  : <><strong>{symbol}</strong><span>{t('songView.fingeringUnavailable', 'Fingering unavailable')}</span></>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
