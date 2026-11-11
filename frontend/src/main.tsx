import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IS_STATIC, loadManifest } from './services/staticData'

/**
 * In static demo mode the snapshot manifest has to land before the first
 * render. It carries the date the snapshot was taken, and the filter presets
 * resolve against that date rather than the real clock; a render that beat it
 * would compute its default range from today and request a window the snapshot
 * does not contain.
 *
 * Live, this resolves immediately and nothing is awaited.
 */
async function bootstrap() {
  if (IS_STATIC) {
    await loadManifest()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap().catch((error: unknown) => {
  // A failure here means no data at all, so say why in the page rather than
  // leaving an empty root and the reason buried in the console.
  const message = error instanceof Error ? error.message : String(error)
  const root = document.getElementById('root')
  if (root) {
    root.textContent = message
    root.setAttribute('style', 'padding:2rem;font:14px/1.6 ui-monospace,monospace')
  }
  console.error(error)
})
