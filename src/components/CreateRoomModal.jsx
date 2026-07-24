import { useState } from 'react'
import { track } from '../lib/analytics'
import { LuX, LuPlus } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'

export default function CreateRoomModal({ onClose, onCreated }) {
  const { user } = useApp()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async () => {
    if (!name.trim()) { setError('請輸入房間名稱'); return }
    setLoading(true)
    setError(null)

    const { data: room, error: err } = await supabase
      .from('rooms')
      .insert({ name: name.trim(), created_by: user.id })
      .select()
      .single()

    if (err) { track('create_room_error'); setError('建立失敗，請再試一次'); setLoading(false); return }

    await supabase.from('room_members').insert({ room_id: room.id, user_id: user.id })
    track('create_room_success')
    onCreated(room)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-[32px] w-full max-w-[480px] p-6">
        <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-brand-deep">建立新房間</h2>
          <button onClick={onClose} className="text-brand-mid/60 hover:text-brand-deep w-8 h-8 flex items-center justify-center">
            <LuX className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">房間名稱</label>
          <input
            type="text"
            placeholder="例：永和溫馨公寓 🌱"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none text-lg"
            autoFocus
          />
        </div>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-brand-lime text-brand-deep font-bold py-4 rounded-2xl text-lg hover:brightness-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? '建立中...' : <><LuPlus className="w-5 h-5 stroke-[2.5]" /> 建立房間</>}
        </button>
        <p className="text-center text-brand-mid/60 text-xs mt-3">建立後可以分享邀請連結給成員</p>
      </div>
    </div>
  )
}
