import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

registerSW({ immediate: true });

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
