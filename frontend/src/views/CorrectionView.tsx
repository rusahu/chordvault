import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { detectFormat, toChordPro, ensureKeyDirective } from '../lib/chords';
import type { Song } from '../types';

interface CorrectionViewProps {
  songId: number;
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function CorrectionView({ songId, navigate }: CorrectionViewProps) {
  const apiCall = useApi();
  const toast = useToast();
  const [content, setContent] = useState('');

  useEffect(() => {
    apiCall<Song>('GET', `/api/songs/${songId}`)
      .then((s) => setContent(s.content))
      .catch((e) => { toast(e.message, 'error'); navigate('browse'); });
  }, [songId, apiCall, navigate, toast]);

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed) { toast('Content is required', 'error'); return; }
    if (trimmed.length > 100000) { toast('Content too large', 'error'); return; }
    if (!detectFormat(trimmed)) { toast('No chords detected. Add chords (e.g. [C], [G]) before submitting.', 'error'); return; }
    let final = toChordPro(trimmed);
    final = ensureKeyDirective(final);
    try {
      await apiCall('POST', `/api/songs/${songId}/correction`, { content: final });
      toast('Correction submitted for review', 'success');
      navigate('song-view', { id: String(songId) });
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <>
      <div className="edit-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('song-view', { id: String(songId) })}>&#8592; Cancel</button>
        <h2>Submit Correction</h2>
        <button className="btn btn-sm" onClick={submit}>Submit</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
        Edit the chords below. Your correction will be reviewed by the song owner before being applied.
      </p>
      <div className="field">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Corrected chord sheet..." />
      </div>
    </>
  );
}
