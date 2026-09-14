import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.js'
import { AuthProvider } from './context/AuthProvider'
import { AuthPage } from './components/auth/AuthPage'
import { RequireAuth } from './components/auth/RequireAuth'

/** One-shot wipe: open /?clearDb=1 to clear mock DB + InkLex browser storage. */
function wipeLocalInklexDataIfRequested(): boolean {
  const url = new URL(window.location.href)
  if (url.searchParams.get('clearDb') !== '1') {
    return false
  }

  const localKeys: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key && (key.startsWith('inklex.') || key.startsWith('wordly.'))) {
      localKeys.push(key)
    }
  }
  for (const key of localKeys) {
    localStorage.removeItem(key)
  }

  const sessionKeys: string[] = []
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index)
    if (key && key.startsWith('inklex.')) {
      sessionKeys.push(key)
    }
  }
  for (const key of sessionKeys) {
    sessionStorage.removeItem(key)
  }

  url.searchParams.delete('clearDb')
  const next = `${url.pathname}${url.search}${url.hash}`
  window.location.replace(next || '/')
  return true
}

if (!wipeLocalInklexDataIfRequested()) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            {/* Single App instance so / ↔ /learning does not remount and drop the session. */}
            <Route
              path="*"
              element={
                <RequireAuth>
                  <App />
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </StrictMode>,
  )
}
