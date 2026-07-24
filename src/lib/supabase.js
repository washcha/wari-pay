import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

let _token = null

export function setAuthToken(token) {
  _token = token
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) => {
      // Headers can be a plain object OR a Headers instance — normalize via Headers
      // so we don't drop Content-Type from the Supabase client (was causing PGRST102).
      const headers = new Headers(options.headers || {})
      headers.set('apikey', supabaseAnonKey)
      if (_token) headers.set('Authorization', `Bearer ${_token}`)
      return fetch(url, { ...options, headers })
    },
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})
