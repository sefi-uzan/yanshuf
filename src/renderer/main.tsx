import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ShortcutHintsProvider } from './components/shortcut-hints';
import { initTheme } from './lib/theme';
import './index.css';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShortcutHintsProvider>
      <App />
    </ShortcutHintsProvider>
  </StrictMode>,
);
