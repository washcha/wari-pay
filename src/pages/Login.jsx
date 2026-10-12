import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { track } from '../lib/analytics'
import { useApp } from '../contexts/AppContext'
import { initLiff, getLiffAccessToken, getLiffProfile, getMockProfile, MOCK_USERS } from '../lib/liff'
import { isGoogleEnabled, renderGoogleButton, cancelGooglePrompt } from '../lib/google'
import { LuReceipt, LuChartColumn, LuArrowRightLeft } from 'react-icons/lu'
import wariPayLogo from '../assets/waripay.png'

const LIFF_ID = import.meta.env.VITE_LIFF_ID
const NO_LIFF = !LIFF_ID || LIFF_ID === 'your-liff-id-here'
const HAS_TEST_LOGIN = new URLSearchParams(window.location.search).has('mock')
const IS_DEV_MODE = import.meta.env.DEV && (NO_LIFF || HAS_TEST_LOGIN)
const GOOGLE_ENABLED = isGoogleEnabled()
const TEST_ACCOUNTS_BY_LANGUAGE = {
  'zh-TW': [
    { username: 'wari-tw-anna', name: '安娜' },
    { username: 'wari-tw-yu', name: '有順' },
  ],
  en: [
    { username: 'wari-en-emma', name: 'Emma' },
    { username: 'wari-en-noah', name: 'Noah' },
  ],
  ja: [
    { username: 'wari-ja-yui', name: '結衣' },
    { username: 'wari-ja-ren', name: '蓮' },
  ],
  ko: [
    { username: 'wari-ko-mina', name: 'Mina' },
    { username: 'wari-ko-jiho', name: '지호' },
  ],
}

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(0)
  const [testUsername, setTestUsername] = useState('')
  const [testPassword, setTestPassword] = useState('')
  const { signIn, t, language } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hasPendingJoin = !!(searchParams.get('join') || sessionStorage.getItem('pendingJoin'))
  const testAccounts = TEST_ACCOUNTS_BY_LANGUAGE[language] || TEST_ACCOUNTS_BY_LANGUAGE['zh-TW']

  // AppContext handles LIFF auto-login on startup; Login page only handles
  // the button click for users not yet logged in to LINE.

  const doSignIn = async (liff) => {
    setLoading(true)
    try {
      const profile = await getLiffProfile(liff)
      if (!profile) return
      const { error: err } = await signIn(profile, { lineAccessToken: getLiffAccessToken(liff) })
      if (err) throw err
      track('login_success', { language })
      const joinRoomId = searchParams.get('join') || sessionStorage.getItem('pendingJoin')
      sessionStorage.removeItem('pendingJoin')
      navigate(joinRoomId ? `/?join=${joinRoomId}` : '/', { replace: true })
    } catch (err) {
      track('login_error', { message: err.message })
      setError(err.message || t('login.errorDefault'))
    } finally {
      setLoading(false)
    }
  }

  const handleLineLogin = async () => {
    track('click_add_line', { language })
    setLoading(true)
    setError(null)
    try {
      const liff = await initLiff()
      if (liff.isInClient?.()) {
        track('open_liff', { language })
        track('liff_open', { language })
      }
      if (liff.isLoggedIn()) {
        await doSignIn(liff)
      } else {
        const joinId = searchParams.get('join')
        if (joinId) sessionStorage.setItem('pendingJoin', joinId)
        liff.login({ redirectUri: window.location.href })
      }
    } catch (err) {
      track('login_error', { message: err.message })
      setError(t('login.errorPrefix', { message: err.message }))
      setLoading(false)
    }
  }

  const handleMockLogin = async (index) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await signIn(getMockProfile(index), { mock: true })
      if (err) throw err
      const joinRoomId = searchParams.get('join')
      navigate(joinRoomId ? `/?join=${joinRoomId}` : '/')
    } catch (err) {
      setError(err.message || t('login.errorDefault'))
    } finally {
      setLoading(false)
    }
  }

  const googleBtnRef = useRef(null)

  const handleGoogleCredential = async (err, idToken) => {
    if (err) {
      // Silent on dismissal — users may just close the popup.
      if (!/dismiss|cancel|closed/i.test(err.message || '')) {
        setError(t('login.errorPrefix', { message: err.message || 'Google' }))
      }
      return
    }
    track('click_add_google', { language })
    setLoading(true)
    setError(null)
    try {
      const { error: signInErr } = await signIn(
        { userId: 'pending-google', displayName: 'Google User', pictureUrl: null },
        { googleIdToken: idToken },
      )
      if (signInErr) throw signInErr
      track('login_success', { language, provider: 'google' })
      const joinRoomId = searchParams.get('join') || sessionStorage.getItem('pendingJoin')
      sessionStorage.removeItem('pendingJoin')
      navigate(joinRoomId ? `/?join=${joinRoomId}` : '/', { replace: true })
    } catch (e) {
      track('login_error', { message: e.message, provider: 'google' })
      setError(e.message || t('login.errorDefault'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!GOOGLE_ENABLED) return
    if (IS_DEV_MODE || HAS_TEST_LOGIN) return
    if (!googleBtnRef.current) return
    renderGoogleButton(googleBtnRef.current, handleGoogleCredential).catch((e) => {
      console.warn('[google] render failed:', e.message)
    })
    return () => cancelGooglePrompt()
  }, [language])

  const handleTestLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await signIn(
        { userId: 'test-login', displayName: 'Wari Test', pictureUrl: null },
        { testLogin: { username: testUsername.trim(), password: testPassword } },
      )
      if (err) throw err
      const joinRoomId = searchParams.get('join')
      navigate(joinRoomId ? `/?join=${joinRoomId}` : '/')
    } catch (err) {
      setError(err.message || t('login.errorDefault'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#F6F7F4' }}>
      <div className="text-center mb-10">
        <img src={wariPayLogo} alt="Wari Pay" className="w-44 h-44 mx-auto mb-4 object-contain" />
        <p className="text-brand-mid/70 text-sm">{t('login.tagline')}</p>
      </div>

      {hasPendingJoin && (
        <div className="w-full max-w-sm mb-4 bg-brand-lime/80 text-brand-deep text-sm font-medium rounded-2xl px-4 py-3 text-center">
          {t('login.invited')}
        </div>
      )}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-soft p-8">
        {IS_DEV_MODE ? (
          <>
            <div className="bg-brand-mint border border-brand-mid/20 rounded-2xl p-3 mb-4">
              <p className="text-brand-deep text-xs font-medium text-center">{t('login.devMode')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {MOCK_USERS.map((u, i) => (
                <button key={u.userId} onClick={() => setSelectedUser(i)}
                  className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-colors text-left ${
                    selectedUser === i ? 'border-brand-deep bg-brand-mint' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-brand-mint flex items-center justify-center text-sm font-bold text-brand-deep flex-shrink-0">
                    {u.displayName[0]}
                  </div>
                  <span className="text-sm font-medium text-brand-deep">{u.displayName}</span>
                </button>
              ))}
            </div>
            {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
            <button onClick={() => handleMockLogin(selectedUser)} disabled={loading}
              className="w-full bg-brand-lime text-brand-deep font-bold py-3.5 rounded-2xl hover:brightness-110 transition disabled:opacity-60"
            >
              {loading ? t('login.loggingIn') : t('login.mockLogin', { name: MOCK_USERS[selectedUser].displayName })}
            </button>
          </>
        ) : HAS_TEST_LOGIN ? (
          <>
            <div className="bg-brand-mint border border-brand-mid/20 rounded-2xl p-3 mb-4">
              <p className="text-brand-deep text-xs font-medium text-center">{t('login.testMode')}</p>
            </div>
            <p className="text-brand-mid/70 text-xs leading-relaxed mb-3">{t('login.testHint')}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {testAccounts.map(account => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => setTestUsername(account.username)}
                  className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-colors text-left ${
                    testUsername === account.username ? 'border-brand-deep bg-brand-mint' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-brand-mint flex items-center justify-center text-sm font-bold text-brand-deep flex-shrink-0">
                    {account.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-deep truncate">{account.name}</p>
                    <p className="text-[10px] text-brand-mid/60 truncate">{account.username}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="space-y-3 mb-5">
              <input
                type="text"
                autoComplete="username"
                value={testUsername}
                onChange={e => setTestUsername(e.target.value)}
                placeholder={t('login.testUsername')}
                className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none"
              />
              <input
                type="password"
                autoComplete="current-password"
                value={testPassword}
                onChange={e => setTestPassword(e.target.value)}
                placeholder={t('login.testPassword')}
                className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none"
              />
            </div>
            {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
            <button
              onClick={handleTestLogin}
              disabled={loading || !testUsername.trim() || !testPassword}
              className="w-full bg-brand-lime text-brand-deep font-bold py-3.5 rounded-2xl hover:brightness-110 transition disabled:opacity-60"
            >
              {loading ? t('login.loggingIn') : t('login.testLogin')}
            </button>
            <button
              onClick={handleLineLogin}
              disabled={loading}
              className="w-full mt-3 bg-brand-mint text-brand-deep font-bold py-3.5 rounded-2xl hover:brightness-95 transition disabled:opacity-60"
            >
              {t('login.lineLogin')}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-6 mb-8">
              {[
                { Icon: LuReceipt,        text: t('login.featureReceipt') },
                { Icon: LuChartColumn,    text: t('login.featureReport') },
                { Icon: LuArrowRightLeft, text: t('login.featureSettle') },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-brand-deep flex-shrink-0" />
                  <span className="text-brand-mid text-sm">{text}</span>
                </div>
              ))}
            </div>
            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
            <button onClick={handleLineLogin} disabled={loading}
              className="w-full bg-brand-lime text-brand-deep font-bold py-4 rounded-2xl text-lg hover:brightness-110 transition disabled:opacity-60"
            >
              {loading ? t('login.loggingIn') : t('login.lineLogin')}
            </button>

            {GOOGLE_ENABLED && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 uppercase tracking-wide">{t('login.orDivider')}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div ref={googleBtnRef} className="flex justify-center" />
                <p className="text-center text-brand-mid/70 text-xs leading-relaxed mt-3 px-2">
                  {t('login.googleHint')}
                </p>
                <p className="text-center text-brand-mid/50 text-[11px] leading-relaxed mt-2 px-2">
                  {t('login.accountNote')}
                </p>
              </>
            )}

            <p className="text-center text-gray-400 text-xs mt-4">
              {t('login.consent')}{' '}
              <a href="/privacy" className="underline underline-offset-2 hover:text-gray-600">{t('common.privacy')}</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
