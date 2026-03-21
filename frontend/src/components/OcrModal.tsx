import { useState, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

interface OcrModalProps {
  hasGeminiKey: boolean;
  onResult: (text: string, language?: string | null) => void;
  onClose: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function OcrModal({ hasGeminiKey, onResult, onClose }: OcrModalProps) {
  const api = useApi();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultText, setResultText] = useState('');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const process = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast('Please select an image first', 'error'); return; }
    if (!hasGeminiKey) { toast('Please set up your Gemini API key in Settings first', 'error'); return; }

    setProcessing(true);
    setProgress(0);
    try {
      setProgress(10);
      const base64 = await fileToBase64(file);
      setProgress(30);
      const result = await api<{ text: string; language: string | null }>('POST', '/api/ocr/gemini', { image: base64 });
      setProgress(100);
      setResultText(result.text);
      setDetectedLang(result.language);
    } catch (e) {
      toast(`OCR failed: ${(e as Error).message}`, 'error');
    }
    setProcessing(false);
  };

  const useResult = () => {
    onResult(resultText, detectedLang);
    onClose();
    toast('Text imported — review and edit before saving', 'success');
  };

  return (
    <div className="ocr-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ocr-card">
        <div className="view-header" style={{ marginBottom: 16 }}>
          <h3 className="view-title">Import from photo</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#10005;</button>
        </div>
        <div className="field">
          <label>Select image</label>
          <input type="file" ref={fileRef} accept="image/*" onChange={handleFile} style={{ fontSize: 14, padding: 8 }} />
        </div>
        {preview && (
          <div style={{ marginBottom: 14 }}>
            <img src={preview} className="ocr-preview" alt="Preview" />
          </div>
        )}
        {!hasGeminiKey && (
          <div style={{ marginBottom: 12, padding: 10, background: 'var(--surface)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>
            Requires a Gemini API key. Set one up in Settings.
          </div>
        )}
        <button className="btn" onClick={process} disabled={processing} style={{ width: '100%' }}>
          {processing ? 'Processing...' : 'Extract text'}
        </button>
        {(processing || progress > 0) && (
          <div style={{ marginTop: 12 }}>
            <div className="ocr-progress-bar">
              <div className="ocr-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {resultText && (
          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, display: 'block' }}>
              Extracted text
            </label>
            <textarea className="ocr-result" readOnly value={resultText} />
            {detectedLang && (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
                Detected language: <strong>{detectedLang}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={useResult}>Use this</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
