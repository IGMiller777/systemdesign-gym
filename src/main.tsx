import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startGameWatcher } from './game/watcher'
import { useProgress } from './store'

// Watcher compares old and new progress; start it after the saved progress is loaded,
// otherwise loading itself would look like a huge XP gain.
if (useProgress.persist.hasHydrated()) startGameWatcher()
else useProgress.persist.onFinishHydration(() => startGameWatcher())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
