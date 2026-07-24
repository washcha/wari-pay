import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, setAuthToken } from '../lib/supabase'

const AppContext = createContext(null)

const LIFF_ID = import.meta.env.VITE_LIFF_ID
const IN_LIFF = LIFF_ID && LIFF_ID !== 'your-liff-id-here'

async function fetchToken(userId) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Auth failed (${res.status})`)
  }
  const { token } = await res.json()
  return token
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const signIn = async (profile) => {
    let token = null
    try {
      token = await fetchToken(profile.userId)
    } catch (err) {
      if (!import.meta.env.DEV) return { error: err }
      console.warn('[dev] Auth API unavailable, running without JWT:', err.message)
    }

    if (token) setAuthToken(token)

    const userData = {
      id: profile.userId,
      display_name: profile.displayName,
      picture_url: profile.pictureUrl || null,
    }

    const { error } = await supabase.from('users').upsert(userData, { onConflict: 'id' })
    if (error) return { error }

    setUser(userData)
    localStorage.setItem('roomiepay_user', JSON.stringify(userData))
    if (token) localStorage.setItem('roomiepay_token', token)
    return { error: null }
  }

  const signOut = () => {
    setAuthToken(null)
    setUser(null)
    localStorage.removeItem('roomiepay_user')
    localStorage.removeItem('roomiepay_token')
  }

  useEffect(() => {
    const initAuth = async () => {
      if (IN_LIFF) {
        // In LIFF context: always re-auth to get a fresh token
        // (localStorage token may have expired)
        try {
          const { initLiff, getLiffProfile } = await import('../lib/liff')
          const liff = await initLiff()
          if (liff.isLoggedIn()) {
            const profile = await getLiffProfile(liff)
            if (profile) {
              await signIn(profile)
              setLoading(false)
              return
            }
          }
        } catch {}
        // LIFF failed or not logged in — fall back to localStorage
        const saved = localStorage.getItem('roomiepay_user')
        const token = localStorage.getItem('roomiepay_token')
        if (saved && token) {
          try { setUser(JSON.parse(saved)); setAuthToken(token) } catch {}
        }
      } else {
        // Dev mode: use localStorage
        const saved = localStorage.getItem('roomiepay_user')
        const token = localStorage.getItem('roomiepay_token')
        if (saved && token) {
          try { setUser(JSON.parse(saved)); setAuthToken(token) } catch {}
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  return (
    <AppContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
