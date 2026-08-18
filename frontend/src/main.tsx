import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { initIOS } from './ios'
import { ensureCrossOriginIsolated } from './coi'

// mgba-wasm needs SharedArrayBuffer, which needs a cross-origin isolated page.
// The service worker supplies the COOP/COEP headers GitHub Pages will not, but
// it cannot control the navigation that installed it — so on a first visit this
// reloads once to come back isolated. No-op on every subsequent load.
ensureCrossOriginIsolated()

// Arm the iOS quirks layer before first paint: audio unlock on first gesture,
// zoom/overscroll suppression, wake lock, and visualViewport resize handling.
// Safe to call on every platform — each fix is feature-detected internally.
initIOS()

render(<App />, document.getElementById('app')!)
