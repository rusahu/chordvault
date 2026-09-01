import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { DEFAULT_GEMINI_MODEL } from '../lib/constants';

interface ImportSongModalProps {
  hasGeminiKey: boolean;
  initialTab?: 'url' | 'file';
  onResult: (text: string, language?: string | null) => boolean | void;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImportSongModal({ hasGeminiKey, initialTab = 'url', onResult, onClose }: ImportSongModalProps) {
  const api = useApi();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sourceType, setSourceType] = useState<'url' | 'file'>(initialTab);
  const [sourceUrl, setSourceUrl] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultText, setResultText] = useState('');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_GEMINI_MODEL);
  const [models, setModels] = useState<{ id: string; label: string; hint: string }[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [fixInput, setFixInput] = useState('');
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    api<{ model: string; models: { id: string; label: string; hint: string }[] }>('GET', '/api/settings/ocr-model')
      .then((data) => { setSelectedModel(data.model); setModels(data.models); })
      .catch(() => {});
  }, [api]);

  const resetExtraction = () => {
    setResultText('');
    setDetectedLang(null);
    setChatHistory([]);
    setImageBase64(null);
    setProgress(0);
  };

  const selectSourceType = (type: 'url' | 'file') => {
    setSourceType(type);
    resetExtraction();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const pdf = file.type === 'application/pdf';
    setIsPdf(pdf);
    if (pdf) {
      setPreview(file.name);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
    resetExtraction();
  };

  const process = async () => {
    if (!hasGeminiKey) { toast('Please set up your Gemini API key in Settings first', 'error'); return; }
    const file = fileRef.current?.files?.[0];
    if (sourceType === 'file' && !file) { toast('Please select a file first', 'error'); return; }
    if (sourceType === 'url' && !sourceUrl.trim()) { toast('Please enter a URL first', 'error'); return; }

    setProcessing(true);
    setProgress(10);
    setChatHistory([]);
    try {
      let result: { text: string; language: string | null };
      if (sourceType === 'url') {
        setProgress(30);
        result = await api('POST', '/api/import/url', { url: sourceUrl.trim(), model: selectedModel });
      } else {
        const base64 = await fileToBase64(file as File);
        setImageBase64(base64);
        setProgress(30);
        result = await api('POST', '/api/ocr/gemini', { image: base64, model: selectedModel });
      }
      setProgress(100);
      setResultText(result.text);
      setDetectedLang(result.language);
      setChatHistory([{ role: 'model', text: result.text }]);
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const sendFix = async () => {
    const message = fixInput.trim();
    if (!message || (sourceType === 'file' && !imageBase64)) return;

    setRefining(true);
    setFixInput('');
    const newHistory = [...chatHistory, { role: 'user' as const, text: message }];
    setChatHistory(newHistory);
    try {
      const path = sourceType === 'url' ? '/api/import/url/refine' : '/api/ocr/gemini/refine';
      const source = sourceType === 'url' ? { url: sourceUrl.trim() } : { image: imageBase64 };
      const result = await api<{ text: string }>('POST', path, {
        ...source,
        history: chatHistory,
        message,
        model: selectedModel,
      });
      setResultText(result.text);
      setChatHistory([...newHistory, { role: 'model', text: result.text }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      toast(`Fix failed: ${(e as Error).message}`, 'error');
      setChatHistory(chatHistory);
    } finally {
      setRefining(false);
    }
  };

  const useResult = () => {
    if (onResult(resultText, detectedLang) === false) return;
    onClose();
    toast('Song imported — review and edit before saving', 'success');
  };

  const hasCorrections = chatHistory.some((message) => message.role === 'user');
  const canProcess = sourceType === 'url' ? !!sourceUrl.trim() : !!preview;

  return createPortal(
    <div className="modal-backdrop" data-overlay onClick={(e) => { if (e.target === e.currentTarget && !processing && !refining) onClose(); }}>
      <div className="ocr-card">
        <div className="view-header" style={{ marginBottom: 16 }}>
          <h3 className="view-title">Import Song</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={processing || refining}>&#10005;</button>
        </div>

        {!resultText && (
          <>
            <div className="import-source-tabs" role="tablist" aria-label="Import source">
              <button className={`import-source-tab${sourceType === 'url' ? ' active' : ''}`} role="tab" aria-selected={sourceType === 'url'} onClick={() => selectSourceType('url')}>From URL</button>
              <button className={`import-source-tab${sourceType === 'file' ? ' active' : ''}`} role="tab" aria-selected={sourceType === 'file'} onClick={() => selectSourceType('file')}>Upload file</button>
            </div>

            {sourceType === 'url' ? (
              <div className="field">
                <label htmlFor="song-import-url">Public webpage or PDF URL</label>
                <input id="song-import-url" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && sourceUrl.trim()) process(); }} placeholder="https://example.com/song-or-sheet.pdf" disabled={processing} />
                <div className="muted-text import-source-help">The page must be publicly accessible. Login-only and paywalled pages are not supported.</div>
              </div>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="song-import-file">Select image or PDF</label>
                  <input id="song-import-file" type="file" ref={fileRef} accept="image/*,application/pdf" onChange={handleFile} disabled={processing} style={{ fontSize: 14, padding: 8 }} />
                </div>
                {preview && (
                  <div style={{ marginBottom: 14 }}>
                    {isPdf ? <div className="muted-text import-file-preview">&#128196; {preview}</div> : <img src={preview} className="ocr-preview" alt="Preview" />}
                  </div>
                )}
              </>
            )}

            {!hasGeminiKey && <div className="muted-text import-key-warning">Requires a Gemini API key. Set one up in Settings.</div>}
            {models.length > 0 && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label htmlFor="song-import-model">Model</label>
                <select id="song-import-model" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={processing}>
                  {models.map((model) => <option key={model.id} value={model.id}>{model.label} — {model.hint}</option>)}
                </select>
              </div>
            )}
            <button className="btn" onClick={process} disabled={processing || !canProcess} style={{ width: '100%', padding: '12px 22px', fontSize: 15 }}>
              {processing ? 'Processing…' : '✨ Extract chord sheet'}
            </button>
            {(processing || progress > 0) && <div className="ocr-progress-bar" style={{ marginTop: 12 }}><div className="ocr-progress-fill" style={{ width: `${progress}%` }} /></div>}
          </>
        )}

        {resultText && (
          <div>
            {hasCorrections && (
              <div className="ocr-chat-history">
                {chatHistory.slice(1).map((message, index) => (
                  <div key={index} className={`ocr-chat-bubble ${message.role === 'user' ? 'ocr-chat-user' : 'ocr-chat-ai'}`}>
                    {message.role === 'user' ? message.text : '✓ Fix applied'}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
            <label className="muted-text import-result-label">{hasCorrections ? 'Corrected result' : 'Extracted chord sheet'}</label>
            <textarea className="ocr-result" readOnly value={resultText} />
            {detectedLang && <div className="muted-text" style={{ marginTop: 6 }}>Detected language: <strong>{detectedLang}</strong></div>}
            <div className="ocr-fix-row">
              <input type="text" className="ocr-fix-input" placeholder="Describe what to fix…" value={fixInput} onChange={(e) => setFixInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFix(); } }} disabled={refining} />
              <button className="btn btn-sm" onClick={sendFix} disabled={refining || !fixInput.trim()}>{refining ? '…' : 'Fix'}</button>
            </div>
            <div className="muted-text" style={{ fontSize: 12, marginTop: 4 }}>For example: “move the G chord to the next word”</div>
            <div className="flex-row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={useResult}>Use in editor</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export const OcrModal = ImportSongModal;
