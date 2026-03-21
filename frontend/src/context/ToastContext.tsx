import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';

interface ToastState {
  message: string;
  type: string;
  visible: boolean;
}

interface ToastContextValue {
  toast: (msg: string, type?: string) => void;
  state: ToastState;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>({ message: '', type: '', visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string, type = '') => {
    clearTimeout(timerRef.current);
    setState({ message: msg, type, visible: true });
    timerRef.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ toast, state }), [toast, state]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): (msg: string, type?: string) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}

export function useToastState(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastState must be used within ToastProvider');
  return ctx.state;
}
