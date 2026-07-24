import { useState } from 'react'
import { LuX, LuCheck, LuShare2 } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { openLineShare } from '../lib/liff'

export default function SettlePaymentModal({ amount, roomId, month, existingPayment, advanceTimestamp, onClose, onSaved }) {
  const { user } = useApp()
  const [note, setNote] = useState(existingPayment?.note || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    const payload = {
      room_id: roomId,
      month,
      payer_id: user.id,
      amount,
      note: note.trim() || null,
    }
    // 結清差額時，更新時間戳讓下次以這個時間點為新的分界
    if (advanceTimestamp) payload.created_at = new Date().toISOString()

    const { error: saveErr } = await supabase
      .from('settlement_payments')
      .upsert(payload, { onConflict: 'room_id,month,payer_id' })

    if (saveErr) { setError('儲存失敗，請再試一次'); setLoading(false); return }
    setSaved(true)
    // 不在這裡呼叫 onSaved()，等使用者點「完成」或「分享」再關閉，讓 success state 有機會顯示
  }

  const handleShare = () => {
    const [year, m] = month.split('-')
    const name = user?.display_name || '成員'
    const lines = [
      `✅ ${name} 已結清 ${year}年${parseInt(m)}月費用 NT$${amount.toLocaleString()}`,
    ]
    if (note.trim()) lines.push(`備注：${note.trim()}`)
    lines.push('', '🐸 哇哩 Wari Pay — 點此查看', 'https://www.washcc.cc')
    openLineShare(lines.join('\n'))
    onSaved()
  }

  if (saved) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
        <div className="bg-white rounded-t-[32px] w-full max-w-[480px]">
          <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mt-3 mb-1" />
          <div className="px-4 pb-8 pt-3">
            <div className="text-center mb-7">
              <div className="w-16 h-16 bg-brand-lime rounded-full flex items-center justify-center mx-auto mb-3">
                <LuCheck className="w-8 h-8 text-brand-deep" />
              </div>
              <h2 className="text-xl font-bold text-brand-deep">已記錄結清！</h2>
              <p className="text-sm text-brand-mid mt-1">
                NT$ {amount.toLocaleString()} · {month.split('-')[0]}年{parseInt(month.split('-')[1])}月
              </p>
              {note.trim() && (
                <p className="text-xs text-brand-mid/70 mt-1.5 px-4">{note.trim()}</p>
              )}
            </div>

            <button
              onClick={handleShare}
              className="w-full bg-[#06C755] text-white font-semibold py-3.5 rounded-2xl text-sm mb-3 flex items-center justify-center gap-2 hover:brightness-95 transition"
            >
              <LuShare2 className="w-4 h-4" />
              分享到 LINE 群
            </button>

            <button
              onClick={onSaved}
              className="w-full bg-brand-lime text-brand-deep font-semibold py-3.5 rounded-2xl text-sm hover:brightness-95 transition"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-[32px] w-full max-w-[480px]">
        <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mt-3 mb-1" />
        <div className="px-4 pb-8 pt-3">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-brand-deep">結清款項</h2>
            <button onClick={onClose} className="text-brand-mid/60 hover:text-brand-deep w-8 h-8 flex items-center justify-center">
              <LuX className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-red-50 rounded-3xl p-5 mb-5 text-center">
            <p className="text-xs text-red-400 mb-1">需補繳金額（台幣）</p>
            <p className="text-4xl font-bold text-red-500">NT$ {Math.abs(amount).toLocaleString()}</p>
          </div>

          <div className="mb-6">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">備註</label>
            <textarea
              placeholder="例：已轉帳給 Alice，備註 6月房費..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none resize-none text-sm"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-brand-lime text-brand-deep font-bold py-4 rounded-2xl text-lg hover:brightness-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? '儲存中...' : <><LuCheck className="w-5 h-5" /> {existingPayment ? '更新記錄' : '確認結清'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
