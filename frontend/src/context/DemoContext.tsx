import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

interface DemoContextValue {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
}

const DemoContext = createContext<DemoContextValue>({ demoMode: false, setDemoMode: () => {} });

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState(false);
  const setDemoMode = useCallback((v: boolean) => setDemoModeState(v), []);
  const value = useMemo(() => ({ demoMode, setDemoMode }), [demoMode, setDemoMode]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  return useContext(DemoContext);
}
