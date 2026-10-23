import React, { Suspense, lazy } from 'react'
import { reloadWhenIdle } from './ui/draft'
import ReactDOM from 'react-dom/client'
import App from './App'
import MobileApp from './mobile/MobileApp'
import DeskApp from './app/DeskApp'
import { getUiMode } from './mobile/uiMode'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'

// The shopping app (shop.stuparu.eu) is a separate build of the same fork: VITE_APP=shop.
// eslint-disable-next-line react-refresh/only-export-components -- the entry file, never hot-reloaded as a module
const ShopApp = lazy(() => import('./shop/ShopApp'))
const isShop = import.meta.env.VITE_APP === 'shop'

// Register service worker for PWA support (offline caching, installability)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Check for updates periodically (every 30 min)
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);

      // When a new SW is installed and waiting, reload to activate it
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version ready (the new SW called skipWaiting). Reload to use it, but never while
            // someone is typing, recording or has photos waiting: then at the next idle moment in
            // the background (ui/draft.ts; my.design principles/09-platform.md).
            reloadWhenIdle(() => window.location.reload());
          }
        });
      });
    }).catch(() => {
      // SW registration failed — app works fine without it
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isShop ? (
        <Suspense fallback={null}><ShopApp /></Suspense>
      ) : (
        <ThemeProvider>
          {getUiMode() === 'mobile' ? <MobileApp /> : getUiMode() === 'app' ? <DeskApp /> : <App />}
        </ThemeProvider>
      )}
    </ErrorBoundary>
  </React.StrictMode>,
)
