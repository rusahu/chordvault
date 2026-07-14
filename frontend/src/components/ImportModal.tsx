import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import { useToast } from '../context/ToastContext';
import { importSongs, ApiError, type ImportResult } from '../lib/api';
import { fileToSong, chunkSongs } from '../lib/import';
import { IMPORT_ACCEPT, IMPORT_CONFIRM_FILE_COUNT, DEMO_MAX_IMPORT } from '../lib/constants';

interface ImportModalProps {
  onClose: () => void;
  onDone: () => void;
}

interface Summary {
  imported: number;
  skipped: { filename: string }[];
  errors: { filename: string; error: string }[];
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ImportModal({ onClose, onDone }: ImportModalProps) {
  const { user } = useAuth();
  const { demoMode } = useDemo();
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    let picked = Array.from(e.target.files ?? []);
    if (demoMode && picked.length > DEMO_MAX_IMPORT) picked = picked.slice(0, DEMO_MAX_IMPORT);
    setFiles(picked);
    setSummary(null);
  };

  async function postBatchWithRetry(songs: { content: string }[]): Promise<ImportResult> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await importSongs(songs, user?.token as string);
      } catch (e) {
        if (e instanceof ApiError && e.status === 429 && attempt < 3) {
          await sleep(1500);
          continue;
        }
        throw e;
      }
    }
  }

  const start = async () => {
    if (files.length === 0) return;
    if (!demoMode && files.length > IMPORT_CONFIRM_FILE_COUNT &&
        !confirm(`You selected ${files.length} files. Import all of them?`)) return;

    setBusy(true);
    try {
      const texts = await Promise.all(files.map(readText));
      const songs = texts.map((t, i) => fileToSong(files[i].name, t));
      const batches = chunkSongs(songs);

      const agg: Summary = { imported: 0, skipped: [], errors: [] };
      let offset = 0;
      setTotal(songs.length);
      setProgress(0);

      for (const batch of batches) {
        const res = await postBatchWithRetry(batch);
        agg.imported += res.imported;
        for (const s of res.skipped) agg.skipped.push({ filename: files[offset + s.index].name });
        for (const er of res.errors) agg.errors.push({ filename: files[offset + er.index].name, error: er.error });
        offset += batch.length;
        setProgress(offset);
      }
      setSummary(agg);
      onDone();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop" data-overlay onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="ocr-card">
        <div className="view-header" style={{ marginBottom: 16 }}>
          <h3 className="view-title">Import ChordPro files</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>&#10005;</button>
        </div>

        {!summary && (
          <>
            <div className="field">
              <label>Select ChordPro files</label>
              <input
                data-testid="import-file-input"
                type="file"
                multiple
                accept={IMPORT_ACCEPT}
                onChange={handleFiles}
                disabled={busy}
                style={{ fontSize: 14, padding: 8 }}
              />
            </div>
            {demoMode && (
              <div className="muted-text" style={{ marginBottom: 12 }}>
                Demo mode: only the first {DEMO_MAX_IMPORT} songs will be imported.
              </div>
            )}
            {files.length > 0 && <div className="muted-text" style={{ marginBottom: 12 }}>{files.length} file(s) selected</div>}
            {busy && <div className="muted-text" style={{ marginBottom: 12 }}>Importing {progress} / {total}…</div>}
            <button className="btn btn-primary" data-testid="import-start" onClick={start} disabled={busy || files.length === 0}>
              {busy ? 'Importing…' : 'Import'}
            </button>
          </>
        )}

        {summary && (
          <div data-testid="import-summary">
            <p>
              <strong>{summary.imported}</strong> imported ·{' '}
              <strong>{summary.skipped.length}</strong> already in your library ·{' '}
              <strong>{summary.errors.length}</strong> errors
            </p>
            {summary.errors.length > 0 && (
              <details>
                <summary>Skipped with errors ({summary.errors.length})</summary>
                <ul>{summary.errors.map((er, i) => <li key={i}>{er.filename} — {er.error}</li>)}</ul>
              </details>
            )}
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
