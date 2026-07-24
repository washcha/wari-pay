import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LuChevronRight, LuHouse, LuSettings2 } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import CreateRoomModal from '../components/CreateRoomModal'
import JoinRoomModal from '../components/JoinRoomModal'
import waripayLoading from '../assets/waripay_loading.png'
import waripayEmpty from '../assets/waripay-emptyroom.png'

function Avatar({ src, name, size = 10 }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=144516&color=B0EC70`
  return (
    <img
      src={src || fallback}
      alt={name}
      className={`w-${size} h-${size} rounded-full object-cover`}
      onError={e => { e.target.src = fallback }}
    />
  )
}

export default function Home() {
  const { user, signOut } = useApp()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
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
      .select('rooms(id, name, created_at, created_by), joined_at')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    setRooms(data?.map(r => r.rooms).filter(Boolean) || [])
    setLoading(false)
  }

  const handleSignOut = () => {
    setShowSettingsMenu(false)
    setConfirm({
      title: '確定要登出嗎？',
      message: '登出後需要重新以 LINE 帳號登入。',
      danger: false,
      onConfirm: signOut,
    })
  }

  const executeDeleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('刪除失敗')
      await signOut()
    } catch {
      alert('刪除帳號失敗，請再試一次或聯絡 s840835@gmail.com')
      setDeletingAccount(false)
    }
  }

  const deleteAccount = () => {
    setShowSettingsMenu(false)
    setConfirm({
      title: '確定要刪除帳號嗎？',
      message: '所有房間記錄、費用與個人資料都會一併刪除，此操作無法復原，請謹慎確認。',
      danger: true,
      onConfirm: executeDeleteAccount,
    })
  }

  const autoJoin = async (roomId) => {
    const [{ count }, { data: alreadyMember }] = await Promise.all([
      supabase.from('room_members').select('*', { count: 'exact', head: true }).eq('room_id', roomId),
      supabase.from('room_members').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle(),
    ])

    if (!alreadyMember && count >= 20) {
      setJoinError('此房間已達人數上限（20 人），無法加入')
      return
    }

    await supabase
      .from('room_members')
      .upsert({ room_id: roomId, user_id: user.id }, {
        onConflict: 'room_id,user_id',
        ignoreDuplicates: true,
      })
    navigate(`/room/${roomId}`)
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-deep text-white px-5 pt-12 pb-6 rounded-b-[32px]">
        <p className="text-brand-mint/70 text-sm mb-3">歡迎回來</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar src={user.picture_url} name={user.display_name} size={10} />
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
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-brand-mid/50 uppercase tracking-wider">設定</p>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 text-sm text-brand-deep text-left hover:bg-brand-mint/50"
                >
                  登出
                </button>
                <button
                  onClick={() => { setShowSettingsMenu(false); navigate('/privacy') }}
                  className="w-full px-4 py-3 text-sm text-brand-deep text-left hover:bg-brand-mint/50"
                >
                  隱私政策
                </button>
                <div className="border-t border-brand-mint/30" />
                <button
                  onClick={deleteAccount}
                  disabled={deletingAccount}
                  className="w-full px-4 py-3 text-sm text-red-500 text-left hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingAccount ? '刪除中...' : '刪除帳號'}
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
          <div className="text-center py-20">
            <img src={waripayEmpty} alt="還沒有房間" className="w-32 h-32 mx-auto mb-4" />
            <p className="text-brand-deep font-medium">還沒有房間</p>
            <p className="text-brand-mid/70 text-sm mt-2">建立或加入一個房間開始記帳吧！</p>
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
                  建立於 {new Date(room.created_at).toLocaleDateString('zh-TW')}
                </p>
              </div>
              <LuChevronRight className="text-brand-mid/50 w-5 h-5 flex-shrink-0" />
            </button>
          ))
        )}
      </div>

      <div className="fixed bottom-8 left-0 right-0 px-4 max-w-[480px] mx-auto flex gap-3">
        <button
          onClick={() => setShowJoin(true)}
          className="flex-1 bg-brand-mint text-brand-deep font-bold py-3.5 rounded-2xl shadow-card hover:brightness-95 active:scale-95 transition"
        >
          加入房間
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="flex-1 bg-brand-lime text-brand-deep font-bold py-3.5 rounded-2xl shadow-card hover:brightness-95 active:scale-95 transition"
        >
          建立房間
        </button>
      </div>

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
                取消
              </button>
              <button
                onClick={() => { setConfirm(null); confirm.onConfirm() }}
                className={`flex-1 font-bold py-3 rounded-2xl transition ${
                  confirm.danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-brand-lime text-brand-deep hover:brightness-95'
                }`}
              >
                確認
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
    </div>
  )
}
