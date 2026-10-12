import { useState } from 'react'
import { track } from '../lib/analytics'
import { LuX, LuPlus, LuPencilLine, LuShare2 } from 'react-icons/lu'
import { hasAuthToken, supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import InviteSheet from './InviteSheet'

const CURRENCIES = ['TWD', 'USD', 'JPY', 'KRW']

export default function CreateRoomModal({ onClose, onCreated }) {
  const { user, t, language } = useApp()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('TWD')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [createdRoom, setCreatedRoom] = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [pendingCreate, setPendingCreate] = useState(false)

  const requestCreate = () => {
    if (!name.trim()) {
      setError(t('createRoom.missingName'))
      return
    }
    setError(null)
    setPendingCreate(true)
  }

  const handleCreate = async () => {
    if (!name.trim()) { setError(t('createRoom.missingName')); return }
    setPendingCreate(false)
    setLoading(true)
    setError(null)

    if (import.meta.env.DEV && !hasAuthToken()) {
      const room = {
        id: `local-demo-${Date.now()}`,
        name: name.trim(),
        created_by: user.id,
        base_currency: currency,
        created_at: new Date().toISOString(),
      }
      localStorage.setItem(`roomiepay_demo_room_${room.id}`, JSON.stringify(room))
      track('create_group', { language, base_currency: currency, mode: 'local_demo' })
      setCreatedRoom(room)
      setLoading(false)
      return
    }

    const { data: room, error: err } = await supabase
      .from('rooms')
      .insert({ name: name.trim(), created_by: user.id, base_currency: currency })
      .select()
      .single()

    if (err) {
      track('create_room_error', { language, message: err.message })
      const message = String(err.message || '').toLowerCase()
      if (message.includes('jwt expired')) {
        setError(t('createRoom.jwtExpired'))
      } else if (message.includes('base_currency')) {
        setError(t('createRoom.migrationMissing'))
      } else {
        setError(t('createRoom.failed', { message: err.message || t('login.errorDefault') }))
      }
      setLoading(false)
      return
    }

    const { error: memberErr } = await supabase.from('room_members').insert({ room_id: room.id, user_id: user.id })
    if (memberErr && memberErr.code !== '23505') {
      track('create_room_error', { language, step: 'room_members', message: memberErr.message })
      setError(t('createRoom.memberFailed', { message: memberErr.message || t('login.errorDefault') }))
      setLoading(false)
      return
    }
    track('create_group', { language, base_currency: currency })
    track('ledger_created', { language, base_currency: currency })
    setCreatedRoom(room)
    setLoading(false)
  }

  if (showInvite && createdRoom) {
    return (
      <InviteSheet
        roomId={createdRoom.id}
        roomName={createdRoom.name}
        onClose={() => onCreated(createdRoom)}
      />
    )
  }

  if (createdRoom) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
        <div className="bg-white rounded-t-[32px] w-full max-w-[480px] p-6">
          <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mb-6" />
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🐸</div>
            <h2 className="text-xl font-bold text-brand-deep mb-1">{t('createRoom.successTitle', { name: createdRoom.name })}</h2>
            <p className="text-brand-mid/70 text-sm">{t('createRoom.successSubtitle')}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setShowInvite(true)}
              className="w-full bg-brand-lime text-brand-deep font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:brightness-95 transition"
            >
              <LuShare2 className="w-5 h-5" />
              {t('createRoom.inviteFriends')}
            </button>
            <button
              onClick={() => onCreated(createdRoom)}
              className="w-full bg-brand-mint text-brand-deep font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 hover:brightness-95 transition"
            >
              <LuPencilLine className="w-5 h-5" />
              {t('createRoom.startSolo')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-[32px] w-full max-w-[480px] p-6">
        <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-brand-deep">{t('createRoom.title')}</h2>
          <button onClick={onClose} className="text-brand-mid/60 hover:text-brand-deep w-8 h-8 flex items-center justify-center">
            <LuX className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">{t('createRoom.nameLabel')}</label>
          <input
            type="text"
            placeholder={t('createRoom.namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none text-lg"
            autoFocus
          />
        </div>
        <div className="mb-5">
          <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">{t('createRoom.currencyLabel')}</label>
          <div className="relative">
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none bg-white text-lg appearance-none pr-10"
            >
              {CURRENCIES.map(code => (
                <option key={code} value={code}>{t(`createRoom.currency${code}`)}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-brand-mid/60">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-brand-mid/70 mt-2 leading-relaxed">
            {t('createRoom.currencyDesc')}
          </p>
        </div>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        <button
          onClick={requestCreate}
          disabled={loading}
          className="w-full bg-brand-lime text-brand-deep font-bold py-4 rounded-2xl text-lg hover:brightness-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? t('createRoom.loading') : <><LuPlus className="w-5 h-5 stroke-[2.5]" /> {t('createRoom.submit')}</>}
        </button>
        <p className="text-center text-brand-mid/60 text-xs mt-3">{t('createRoom.footer')}</p>
      </div>

      {pendingCreate && !loading && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-soft">
            <h3 className="text-brand-deep font-bold text-lg mb-2">{t('createRoom.confirmCurrencyTitle')}</h3>
            <p className="text-brand-mid text-sm leading-relaxed mb-6">
              {t('createRoom.confirmCurrencyMessage', { currency: t(`createRoom.currency${currency}`) }).split('\n').map((line, index) => (
                <span key={`${line}-${index}`}>
                  {line}
                  {index < 1 && <><br /><br /></>}
                </span>
              ))}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingCreate(false)}
                className="flex-1 bg-brand-mint text-brand-deep font-bold py-3 rounded-2xl hover:brightness-95 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 bg-brand-lime text-brand-deep font-bold py-3 rounded-2xl hover:brightness-95 transition"
              >
                {t('createRoom.confirmCreate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
