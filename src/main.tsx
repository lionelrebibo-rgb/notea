import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

registerSW({ immediate: true });

// keep Chrome's install prompt so the app can offer its own "Installer" button
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__installPrompt = e;
  window.dispatchEvent(new Event('notea-installable'));
});
window.addEventListener('appinstalled', () => {
  (window as any).__installPrompt = null;
  window.dispatchEvent(new Event('notea-installable'));
});

// keep the screen awake while practising (supported by Chrome on Android)
async function keepAwake() {
  try {
    await (navigator as any).wakeLock?.request('screen');
  } catch {
    /* not supported / not allowed */
  }
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && keepAwake());
document.addEventListener('pointerdown', keepAwake, { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
