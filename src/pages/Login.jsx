import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { track } from '../lib/analytics'
import { useApp } from '../contexts/AppContext'
import { initLiff, getLiffProfile, getMockProfile, MOCK_USERS } from '../lib/liff'
import { LuReceipt, LuChartColumn, LuArrowRightLeft } from 'react-icons/lu'
import wariPayLogo from '../assets/waripay.png'

const LIFF_ID = import.meta.env.VITE_LIFF_ID
const NO_LIFF = !LIFF_ID || LIFF_ID === 'your-liff-id-here'
const IS_DEV_MODE = (import.meta.env.DEV && NO_LIFF) || new URLSearchParams(window.location.search).has('mock')

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(0)
  const { signIn } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hasPendingJoin = !!(searchParams.get('join') || sessionStorage.getItem('pendingJoin'))

  // AppContext handles LIFF auto-login on startup; Login page only handles
  // the button click for users not yet logged in to LINE.

  const doSignIn = async (liff) => {
    setLoading(true)
    try {
      const profile = await getLiffProfile(liff)
      if (!profile) return
      const { error: err } = await signIn(profile)
      if (err) throw err
      track('login_success')
      const joinRoomId = searchParams.get('join') || sessionStorage.getItem('pendingJoin')
      sessionStorage.removeItem('pendingJoin')
      navigate(joinRoomId ? `/?join=${joinRoomId}` : '/', { replace: true })
    } catch (err) {
      track('login_error', { message: err.message })
      setError(err.message || '登入失敗，請再試一次')
    } finally {
      setLoading(false)
    }
  }

  const handleLineLogin = async () => {
    track('login_attempt')
    setLoading(true)
    setError(null)
    try {
      const liff = await initLiff()
      if (liff.isLoggedIn()) {
        await doSignIn(liff)
      } else {
        const joinId = searchParams.get('join')
        if (joinId) sessionStorage.setItem('pendingJoin', joinId)
        liff.login({ redirectUri: window.location.href })
      }
    } catch (err) {
      track('login_error', { message: err.message })
      setError('登入失敗：' + err.message)
      setLoading(false)
    }
  }

  const handleMockLogin = async (index) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await signIn(getMockProfile(index))
      if (err) throw err
      const joinRoomId = searchParams.get('join')
      navigate(joinRoomId ? `/?join=${joinRoomId}` : '/')
    } catch (err) {
      setError(err.message || '登入失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#F6F7F4' }}>
      <div className="text-center mb-10">
        <img src={wariPayLogo} alt="Wari Pay" className="w-44 h-44 mx-auto mb-4 object-contain" />
        <p className="text-brand-mid/70 text-sm">哇哩 · 免下載 App，在 LINE 直接分帳</p>
      </div>

      {hasPendingJoin && (
        <div className="w-full max-w-sm mb-4 bg-brand-lime/80 text-brand-deep text-sm font-medium rounded-2xl px-4 py-3 text-center">
          🐸 朋友邀請你加入分帳房間，登入後自動加入！
        </div>
      )}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-soft p-8">
        {IS_DEV_MODE ? (
          <>
            <div className="bg-brand-mint border border-brand-mid/20 rounded-2xl p-3 mb-4">
              <p className="text-brand-deep text-xs font-medium text-center">🧪 開發測試模式</p>
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
              {loading ? '登入中...' : `以「${MOCK_USERS[selectedUser].displayName}」身份登入`}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-6 mb-8">
              {[
                { Icon: LuReceipt,        text: '快速記帳，彈性分攤比例' },
                { Icon: LuChartColumn,    text: '月度支出分類報表' },
                { Icon: LuArrowRightLeft, text: '自動結算誰欠誰多少錢' },
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
              {loading ? '登入中...' : '以 LINE 帳號登入'}
            </button>
            <p className="text-center text-gray-400 text-xs mt-4">
              登入即代表同意{' '}
              <a href="/privacy" className="underline underline-offset-2 hover:text-gray-600">隱私權政策</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
