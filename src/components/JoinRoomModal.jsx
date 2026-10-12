import { useState } from 'react'
import { track } from '../lib/analytics'
import { LuX, LuKeyRound } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'

export default function JoinRoomModal({ onClose, onJoined }) {
  const { user, t } = useApp()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const extractRoomId = (raw) => {
    try {
      const url = new URL(raw.trim())
      return url.searchParams.get('join') || raw.trim()
    } catch {
      return raw.trim()
    }
  }

  const handleJoin = async () => {
    const roomId = extractRoomId(input)
    if (!roomId) { setError(t('joinRoom.missing')); return }
    setLoading(true)
    setError(null)

    const [{ count }, { data: alreadyMember }] = await Promise.all([
      supabase.from('room_members').select('*', { count: 'exact', head: true }).eq('room_id', roomId).is('left_at', null),
      supabase.from('room_members').select('id, left_at').eq('room_id', roomId).eq('user_id', user.id).maybeSingle(),
    ])

    if (!alreadyMember && count >= 20) {
      track('join_room_error', { reason: 'room_full' })
      setError(t('joinRoom.full'))
      setLoading(false)
      return
    }

    const { error: joinErr } = alreadyMember?.left_at
      ? await supabase.from('room_members').update({ left_at: null }).eq('id', alreadyMember.id)
      : !alreadyMember
        ? await supabase.from('room_members').insert({ room_id: roomId, user_id: user.id })
        : { error: null }

    if (joinErr && joinErr.code !== '23505') {
      const reason = (joinErr.code === '23503' || joinErr.code === '22P02') ? 'not_found' : 'unknown'
      track('join_room_error', { reason })
      if (reason === 'not_found') {
        setError(t('joinRoom.notFound'))
      } else {
        setError(t('joinRoom.failed'))
      }
      setLoading(false)
      return
    }

    track('join_room_success')
    onJoined(roomId)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-[32px] w-full max-w-[480px] p-6">
        <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-brand-deep">{t('joinRoom.title')}</h2>
          <button onClick={onClose} className="text-brand-mid/60 hover:text-brand-deep w-8 h-8 flex items-center justify-center">
            <LuX className="w-5 h-5" />
          </button>
        </div>
        <p className="text-center text-brand-mid/70 text-sm mb-5">
          {t('joinRoom.desc')}
        </p>
        <div className="mb-4">
          <textarea
            placeholder={t('joinRoom.placeholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={3}
            className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none font-mono text-sm resize-none"
            autoFocus
          />
        </div>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full bg-brand-lime text-brand-deep font-bold py-4 rounded-2xl text-lg hover:brightness-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? t('joinRoom.loading') : <><LuKeyRound className="w-5 h-5" /> {t('joinRoom.submit')}</>}
        </button>
      </div>
    </div>
  )
}
