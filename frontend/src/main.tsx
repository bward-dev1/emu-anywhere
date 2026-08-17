import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { initIOS } from './ios'

// Arm the iOS quirks layer before first paint: audio unlock on first gesture,
// zoom/overscroll suppression, wake lock, and visualViewport resize handling.
// Safe to call on every platform — each fix is feature-detected internally.
initIOS()

render(<App />, document.getElementById('app')!)
