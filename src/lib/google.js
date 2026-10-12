// Google Identity Services (GIS) wrapper.
// We render Google's official Sign-In button so the ID-token flow works
// reliably across browsers (One Tap is unreliable under third-party-cookie
// restrictions). The button fires `onCredential(idToken)` which we then POST
// to /api/auth for server-side verification.

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID

let _scriptPromise = null
let _initialized = false
let _currentCallback = null

export const isGoogleEnabled = () => Boolean(CLIENT_ID)

function loadGisScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.google?.accounts?.id) return Promise.resolve()
  if (_scriptPromise) return _scriptPromise
  _scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script')))
      return
    }
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => {
      _scriptPromise = null
      reject(new Error('Failed to load Google script'))
    }
    document.head.appendChild(s)
  })
  return _scriptPromise
}

function ensureInitialized() {
  if (_initialized) return
  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response) => {
      const cb = _currentCallback
      if (!cb) return
      if (response?.credential) cb(null, response.credential)
      else cb(new Error('No credential returned'))
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    ux_mode: 'popup',
    use_fedcm_for_prompt: true,
  })
  _initialized = true
}

// Render Google's branded sign-in button into `container` (a DOM node).
// `onCredential(err, idToken)` fires when the user completes or cancels.
export async function renderGoogleButton(container, onCredential, options = {}) {
  if (!CLIENT_ID) throw new Error('Google OAuth not configured')
  if (!container) throw new Error('Missing container')
  await loadGisScript()
  ensureInitialized()
  _currentCallback = onCredential
  container.innerHTML = ''
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: options.width || 320,
  })
}

export function cancelGooglePrompt() {
  _currentCallback = null
  try {
    window.google?.accounts?.id?.cancel?.()
  } catch {}
}
