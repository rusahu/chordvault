import { useEffect } from 'react';

type HandlerMap = Record<string, (e: KeyboardEvent) => void>;

export function useKeyboardShortcuts(handlers: HandlerMap, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const handler = handlers[e.key];
      if (handler) handler(e);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled]);
}
