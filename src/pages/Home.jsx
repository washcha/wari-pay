import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LuChevronRight, LuHouse, LuKeyRound, LuPlus, LuSettings2 } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import CreateRoomModal from '../components/CreateRoomModal'
import JoinRoomModal from '../components/JoinRoomModal'
import Avatar from '../components/Avatar'
import { LANGUAGES } from '../lib/i18n'
import waripayLoading from '../assets/waripay_loading.png'
import waripayEmpty from '../assets/waripay-emptyroom.png'

export default function Home() {
  const { user, signOut, language, setLanguage, t } = useApp()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showLanguage, setShowLanguage] = useState(false)
  const [joinError, setJoinError] = useState(null)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    fetchRooms()
    const joinId = searchParams.get('join') || sessionStorage.getItem('pendingJoin')
    if (joinId) { sessionStorage.removeItem('pendingJoin'); autoJoin(joinId) }
  }, [])

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('room_members')
      .select('rooms(id, name, created_at, created_by), joined_at, left_at')
      .eq('user_id', user.id)
      .is('left_at', null)
      .order('joined_at', { ascending: false })

    const nextRooms = data?.map(r => r.rooms).filter(Boolean) || []
    setRooms(nextRooms)
    setLoading(false)
  }

  const handleSignOut = () => {
    setShowSettingsMenu(false)
    setConfirm({
      title: t('home.signOutTitle'),
      message: t('home.signOutMessage'),
      danger: false,
      onConfirm: signOut,
    })
  }

  const executeDeleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const token = localStorage.getItem('roomiepay_token')
      if (!token) throw new Error('No auth token')
      const res = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      await signOut()
    } catch (err) {
      console.error('[delete-account]', err)
      alert(`${t('home.deleteAccountError')}\n\n${err.message}`)
      setDeletingAccount(false)
    }
  }

  const deleteAccount = () => {
    setShowSettingsMenu(false)
    setConfirm({
      title: t('home.deleteAccountTitle'),
      message: t('home.deleteAccountMessage'),
      danger: true,
      onConfirm: executeDeleteAccount,
    })
  }

  const autoJoin = async (roomId) => {
    const [{ count }, { data: alreadyMember }] = await Promise.all([
      supabase.from('room_members').select('*', { count: 'exact', head: true }).eq('room_id', roomId).is('left_at', null),
      supabase.from('room_members').select('id, left_at').eq('room_id', roomId).eq('user_id', user.id).maybeSingle(),
    ])

    if (!alreadyMember && count >= 20) {
      setJoinError(t('home.roomFull'))
      return
    }

    if (alreadyMember?.left_at) {
      await supabase.from('room_members').update({ left_at: null }).eq('id', alreadyMember.id)
    } else if (!alreadyMember) {
      await supabase.from('room_members').insert({ room_id: roomId, user_id: user.id })
    }
    navigate(`/room/${roomId}`)
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-deep text-white px-5 pt-12 pb-6 rounded-b-[32px]">
        <p className="text-brand-mint/70 text-sm mb-3">{t('home.welcome')}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar src={user.picture_url} name={user.display_name} userId={user.id} className="w-10 h-10" />
            <p className="font-bold text-xl">{user.display_name}</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(m => !m)}
              className="w-8 h-8 flex items-center justify-center text-brand-mint rounded-full hover:bg-brand-mid/40"
            >
              <LuSettings2 className="w-4 h-4" />
            </button>
            {showSettingsMenu && (
              <div className="absolute right-0 top-9 bg-white rounded-2xl shadow-soft border border-brand-mint/40 z-30 overflow-hidden min-w-[160px]">
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-brand-mid/50 uppercase tracking-wider">{t('home.settings')}</p>
                <button
                  onClick={() => { setShowSettingsMenu(false); setShowLanguage(true) }}
                  className="w-full px-4 py-3 text-sm text-brand-deep text-left hover:bg-brand-mint/50"
                >
                  {t('common.language')}
                </button>
                <button
                  onClick={() => { setShowSettingsMenu(false); navigate('/privacy') }}
                  className="w-full px-4 py-3 text-sm text-brand-deep text-left hover:bg-brand-mint/50"
                >
                  {t('common.privacy')}
                </button>
                <div className="border-t border-brand-mint/30" />
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 text-sm text-brand-deep text-left hover:bg-brand-mint/50"
                >
                  {t('home.signOut')}
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={deletingAccount}
                  className="w-full px-4 py-3 text-sm text-red-500 text-left hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingAccount ? t('home.deletingAccount') : t('home.deleteAccount')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 pb-32">
        {joinError && (
          <div className="bg-red-50 text-red-500 text-sm text-center py-3 px-4 rounded-2xl">
            {joinError}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-16"><img src={waripayLoading} alt="loading" className="w-20 h-20 animate-bounce" /></div>
        ) : rooms.length === 0 ? (
          <div className="pt-8 pb-4">
            <div className="bg-white rounded-[32px] shadow-soft p-6 text-center overflow-hidden relative">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand-lime/30 rounded-full" />
              <div className="absolute -bottom-16 -left-10 w-36 h-36 bg-brand-mint/60 rounded-full" />
              <div className="relative">
                <img src={waripayEmpty} alt={t('home.startTitle')} className="w-32 h-32 mx-auto mb-4" />
                <p className="text-brand-mid/70 text-xs font-semibold uppercase tracking-[0.18em] mb-2">{t('home.firstRoomEyebrow')}</p>
                <h2 className="text-brand-deep font-bold text-2xl leading-tight">{t('home.startTitle')}</h2>
                <p className="text-brand-mid/75 text-sm leading-relaxed mt-3">
                  {t('home.startBody')}
                </p>

                <div className="grid gap-3 mt-6 text-left">
                  <button
                    onClick={() => setShowCreate(true)}
                    className="bg-brand-lime text-brand-deep rounded-3xl p-4 shadow-card active:scale-[0.98] transition-transform flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center flex-shrink-0">
                      <LuPlus className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-bold">{t('home.createTitle')}</p>
                      <p className="text-brand-mid/75 text-xs mt-1 leading-relaxed">{t('home.createDesc')}</p>
                    </div>
                    <LuChevronRight className="w-5 h-5 text-brand-mid/70 flex-shrink-0" />
                  </button>

                  <button
                    onClick={() => setShowJoin(true)}
                    className="bg-brand-mint text-brand-deep rounded-3xl p-4 shadow-card active:scale-[0.98] transition-transform flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center flex-shrink-0">
                      <LuKeyRound className="w-6 h-6 stroke-[2.3]" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-bold">{t('home.joinTitle')}</p>
                      <p className="text-brand-mid/75 text-xs mt-1 leading-relaxed">{t('home.joinDesc')}</p>
                    </div>
                    <LuChevronRight className="w-5 h-5 text-brand-mid/70 flex-shrink-0" />
                  </button>
                </div>

                <p className="text-brand-mid/60 text-xs leading-relaxed mt-5">
                  {t('home.hint')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          rooms.map(room => (
            <button
              key={room.id}
              onClick={() => navigate(`/room/${room.id}`)}
              className="w-full bg-white rounded-3xl p-4 flex items-center gap-4 shadow-card active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-12 h-12 bg-brand-mint rounded-2xl flex items-center justify-center flex-shrink-0">
                <LuHouse className="w-6 h-6 text-brand-deep" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-brand-deep truncate">{room.name}</p>
                <p className="text-brand-mid/60 text-xs mt-0.5">
                  {t('home.createdAt', { date: new Date(room.created_at).toLocaleDateString(language) })}
                </p>
              </div>
              <LuChevronRight className="text-brand-mid/50 w-5 h-5 flex-shrink-0" />
            </button>
          ))
        )}
      </div>

      {rooms.length > 0 && (
        <div className="fixed bottom-8 left-0 right-0 px-4 max-w-[480px] mx-auto flex gap-3">
          <button
            onClick={() => setShowJoin(true)}
            className="flex-1 bg-brand-mint text-brand-deep font-bold py-3.5 rounded-2xl shadow-card hover:brightness-95 active:scale-95 transition"
          >
            {t('home.joinRoom')}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 bg-brand-lime text-brand-deep font-bold py-3.5 rounded-2xl shadow-card hover:brightness-95 active:scale-95 transition"
          >
            {t('home.createRoom')}
          </button>
        </div>
      )}

      {showSettingsMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSettingsMenu(false)} />
      )}

      {confirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-soft">
            <h3 className="text-brand-deep font-bold text-lg mb-2">{confirm.title}</h3>
            <p className="text-brand-mid text-sm leading-relaxed mb-6">{confirm.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 bg-brand-mint text-brand-deep font-bold py-3 rounded-2xl hover:brightness-95 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => { setConfirm(null); confirm.onConfirm() }}
                className={`flex-1 font-bold py-3 rounded-2xl transition ${
                  confirm.danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-brand-lime text-brand-deep hover:brightness-95'
                }`}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(room) => { setShowCreate(false); fetchRooms(); navigate(`/room/${room.id}`) }}
        />
      )}
      {showJoin && (
        <JoinRoomModal
          onClose={() => setShowJoin(false)}
          onJoined={(roomId) => { setShowJoin(false); fetchRooms(); navigate(`/room/${roomId}`) }}
        />
      )}
      {showLanguage && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-soft">
            <h3 className="text-brand-deep font-bold text-lg mb-2">{t('home.languageTitle')}</h3>
            <p className="text-brand-mid text-sm leading-relaxed mb-5">{t('home.languageDesc')}</p>
            <div className="space-y-2">
              {LANGUAGES.map(option => (
                <button
                  key={option.code}
                  onClick={() => { setLanguage(option.code); setShowLanguage(false) }}
                  className={`w-full rounded-2xl px-4 py-3 text-left border-2 transition ${
                    language === option.code
                      ? 'bg-brand-lime border-brand-deep text-brand-deep'
                      : 'bg-white border-brand-mint text-brand-mid hover:bg-brand-mint/40'
                  }`}
                >
                  <span className="font-bold">{option.nativeLabel}</span>
                  <span className="text-xs ml-2 opacity-70">{option.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowLanguage(false)}
              className="w-full bg-brand-mint text-brand-deep font-bold py-3 rounded-2xl hover:brightness-95 transition mt-5"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
