import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { I18nProvider } from './context/I18nContext';
import { App } from './App';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <I18nProvider>
            <App />
          </I18nProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);
