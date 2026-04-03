import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

interface OcrModalProps {
  hasGeminiKey: boolean;
  onResult: (text: string, language?: string | null) => void;
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

export function OcrModal({ hasGeminiKey, onResult, onClose }: OcrModalProps) {
  const api = useApi();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultText, setResultText] = useState('');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [fixInput, setFixInput] = useState('');
  const [refining, setRefining] = useState(false);

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
    // Reset state on new file
    setResultText('');
    setChatHistory([]);
    setImageBase64(null);
  };

  const process = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast('Please select a file first', 'error'); return; }
    if (!hasGeminiKey) { toast('Please set up your Gemini API key in Settings first', 'error'); return; }

    setProcessing(true);
    setProgress(0);
    setChatHistory([]);
    try {
      setProgress(10);
      const base64 = await fileToBase64(file);
      setImageBase64(base64);
      setProgress(30);
      const result = await api<{ text: string; language: string | null }>('POST', '/api/ocr/gemini', { image: base64 });
      setProgress(100);
      setResultText(result.text);
      setDetectedLang(result.language);
      // Seed chat history with the initial model response
      setChatHistory([{ role: 'model', text: result.text }]);
    } catch (e) {
      toast(`OCR failed: ${(e as Error).message}`, 'error');
    }
    setProcessing(false);
  };

  const sendFix = async () => {
    const msg = fixInput.trim();
    if (!msg || !imageBase64) return;

    setRefining(true);
    setFixInput('');
    const newHistory = [...chatHistory, { role: 'user' as const, text: msg }];
    setChatHistory(newHistory);

    try {
      const result = await api<{ text: string }>('POST', '/api/ocr/gemini/refine', {
        image: imageBase64,
        history: chatHistory,
        message: msg,
      });
      setResultText(result.text);
      setChatHistory([...newHistory, { role: 'model', text: result.text }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      toast(`Fix failed: ${(e as Error).message}`, 'error');
      // Remove the user message on failure
      setChatHistory(chatHistory);
    }
    setRefining(false);
  };

  const useResult = () => {
    onResult(resultText, detectedLang);
    onClose();
    toast('Text imported — review and edit before saving', 'success');
  };

  const hasCorrections = chatHistory.filter(m => m.role === 'user').length > 0;

  return createPortal(
    <div className="ocr-modal" data-overlay onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ocr-card">
        <div className="view-header" style={{ marginBottom: 16 }}>
          <h3 className="view-title">Import from image or PDF</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#10005;</button>
        </div>

        {/* File picker — hide after extraction to save space */}
        {!resultText && (
          <>
            <div className="field">
              <label>Select image or PDF</label>
              <input type="file" ref={fileRef} accept="image/*,application/pdf" onChange={handleFile} style={{ fontSize: 14, padding: 8 }} />
            </div>
            {preview && (
              <div style={{ marginBottom: 14 }}>
                {isPdf ? (
                  <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>
                    &#128196; {preview}
                  </div>
                ) : (
                  <img src={preview} className="ocr-preview" alt="Preview" />
                )}
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
          </>
        )}

        {/* Result + conversation */}
        {resultText && (
          <div style={{ marginTop: resultText ? 0 : 14 }}>
            {/* Correction history */}
            {hasCorrections && (
              <div className="ocr-chat-history">
                {chatHistory.filter(m => m.role === 'user').map((m, i) => (
                  <div key={i} className="ocr-chat-bubble ocr-chat-user">
                    {m.text}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasCorrections ? 'Corrected result' : 'Extracted text'}
              {hasCorrections && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 400, textTransform: 'none' }}>({chatHistory.filter(m => m.role === 'user').length} fix{chatHistory.filter(m => m.role === 'user').length > 1 ? 'es' : ''} applied)</span>}
            </label>
            <textarea className="ocr-result" readOnly value={resultText} />
            {detectedLang && (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
                Detected language: <strong>{detectedLang}</strong>
              </div>
            )}

            {/* Chat input for corrections */}
            <div className="ocr-fix-row">
              <input
                type="text"
                className="ocr-fix-input"
                placeholder="Describe what to fix..."
                value={fixInput}
                onChange={(e) => setFixInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFix(); } }}
                disabled={refining}
              />
              <button
                className="btn btn-sm"
                onClick={sendFix}
                disabled={refining || !fixInput.trim()}
              >
                {refining ? '...' : 'Fix'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              e.g. "move the G chord to the next word" or "verse 2 should be Am not Em"
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" onClick={useResult}>Use this</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
