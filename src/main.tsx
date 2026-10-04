import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import App from './App'
import { applyTheme, usePrefs } from './stores/prefs'

// Apply the saved theme before the first paint to avoid a flash.
applyTheme(usePrefs.getState().theme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support in production builds only (see public/sw.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // The first visit loads before the service worker controls the page, so tell it
  // which build assets are already here; it caches them for offline use.
  const sendLoadedAssets = (to: ServiceWorker | null | undefined) => {
    const urls = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin) && u.includes('/assets/'))
    to?.postMessage({ type: 'cache-urls', urls })
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      // The active worker, which may not control this page yet (first visit).
      .then((reg) => sendLoadedAssets(reg.active))
      .catch(() => {})
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => sendLoadedAssets(navigator.serviceWorker.controller))
}
