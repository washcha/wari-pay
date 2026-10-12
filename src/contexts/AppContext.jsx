import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, setAuthToken } from '../lib/supabase'
import { track } from '../lib/analytics'
import { DEFAULT_LANGUAGE, detectDeviceLanguage, getSavedLanguage, getUrlLanguage, normalizeLanguage, saveLanguage, translate } from '../lib/i18n'

const AppContext = createContext(null)

const LIFF_ID = import.meta.env.VITE_LIFF_ID
const IN_LIFF = LIFF_ID && LIFF_ID !== 'your-liff-id-here'

async function fetchToken({ lineAccessToken, googleIdToken, mockUser, testLogin } = {}) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineAccessToken, googleIdToken, mockUser, testLogin }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Auth failed (${res.status})`)
  }
  return res.json()
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [language, setLanguageState] = useState(() => getUrlLanguage() || getSavedLanguage() || detectDeviceLanguage() || DEFAULT_LANGUAGE)

  const setLanguage = (nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage)
    setLanguageState(normalized)
    saveLanguage(normalized)
  }

  const t = (key, values) => translate(language, key, values)

  useEffect(() => {
    saveLanguage(language)
  }, [language])

  const clearSavedAuth = () => {
    setAuthToken(null)
    localStorage.removeItem('roomiepay_user')
    localStorage.removeItem('roomiepay_token')
  }

  const signIn = async (profile, options = {}) => {
    let token = null
    let verifiedProfile = profile
    try {
      const auth = await fetchToken({
        lineAccessToken: options.lineAccessToken,
        googleIdToken: options.googleIdToken,
        mockUser: options.mock ? profile : null,
        testLogin: options.testLogin,
      })
      token = auth.token
      verifiedProfile = auth.profile || profile
    } catch (err) {
      if (!import.meta.env.DEV) return { error: err }
      console.warn('[dev] Auth API unavailable, running without JWT:', err.message)
    }

    const userData = {
      id: verifiedProfile.userId,
      display_name: verifiedProfile.displayName,
      picture_url: verifiedProfile.pictureUrl || null,
      deleted_at: null,
    }

    if (token) {
      setAuthToken(token)
      const { error } = await supabase.from('users').upsert(userData, { onConflict: 'id' })
      if (error) return { error }
    } else if (!import.meta.env.DEV || !options.mock) {
      return { error: new Error('Auth API unavailable') }
    }

    setUser(userData)
    localStorage.setItem('roomiepay_user', JSON.stringify(userData))
    if (token) localStorage.setItem('roomiepay_token', token)
    return { error: null }
  }

  const signOut = () => {
    clearSavedAuth()
    setUser(null)
  }

  useEffect(() => {
    const restoreSavedUser = async ({ clearOnFailure = false } = {}) => {
      const saved = localStorage.getItem('roomiepay_user')
      const oldToken = localStorage.getItem('roomiepay_token')
      if (!saved) return false

      try {
        const savedUser = JSON.parse(saved)
        if (import.meta.env.DEV) {
          const auth = await fetchToken({ mockUser: { userId: savedUser.id, displayName: savedUser.display_name, pictureUrl: savedUser.picture_url } })
          setAuthToken(auth.token)
          localStorage.setItem('roomiepay_token', auth.token)
          setUser(savedUser)
          return true
        }
        throw new Error('Cannot refresh saved auth without LINE token')
      } catch (err) {
        if (oldToken) {
          try {
            setAuthToken(oldToken)
            setUser(JSON.parse(saved))
            return true
          } catch {}
        }
        if (clearOnFailure) clearSavedAuth()
        return false
      }
    }

    const initAuth = async () => {
      if (IN_LIFF) {
        // In LIFF context: always re-auth to get a fresh token
        // (localStorage token may have expired)
        try {
          const { initLiff, getLiffAccessToken, getLiffProfile } = await import('../lib/liff')
          const liff = await initLiff()
          if (liff.isInClient?.()) {
            track('liff_open', { language })
            track('open_liff', { language })
          }
          if (liff.isLoggedIn()) {
            const profile = await getLiffProfile(liff)
            if (profile) {
              await signIn(profile, { lineAccessToken: getLiffAccessToken(liff) })
              setLoading(false)
              return
            }
          }
        } catch {}
        // LIFF failed or not logged in — fall back to localStorage
        await restoreSavedUser()
      } else {
        await restoreSavedUser({ clearOnFailure: true })
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  return (
    <AppContext.Provider value={{ user, loading, signIn, signOut, language, setLanguage, t }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
