import { useState } from 'react'
import { LuX, LuCopy, LuCheck, LuShare2 } from 'react-icons/lu'
import { shareInviteCard } from '../lib/liff'

const LIFF_ID = import.meta.env.VITE_LIFF_ID

export default function InviteSheet({ roomId, roomName, onClose }) {
  const inviteUrl = LIFF_ID && LIFF_ID !== 'your-liff-id-here'
    ? `https://liff.line.me/${LIFF_ID}?join=${roomId}`
    : `${window.location.origin}/?join=${roomId}`
  const [copied, setCopied] = useState(null)
  const [sharing, setSharing] = useState(false)

  const handleShareCard = async () => {
    setSharing(true)
    await shareInviteCard(roomName, inviteUrl)
    setSharing(false)
  }

  const copy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-[32px] w-full max-w-[480px] p-6">
        <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-brand-deep">邀請成員</h2>
          <button onClick={onClose} className="text-brand-mid/60 hover:text-brand-deep w-8 h-8 flex items-center justify-center">
            <LuX className="w-5 h-5" />
          </button>
        </div>
        <p className="text-brand-mid/70 text-sm mb-5">複製邀請連結或房間 ID 傳給成員</p>

        <div className="mb-4">
          <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">邀請連結</label>
          <div className="flex items-center gap-2 bg-brand-cream border border-brand-mint rounded-2xl px-4 py-3">
            <p className="flex-1 text-sm text-brand-deep font-mono truncate">{inviteUrl}</p>
            <button
              onClick={() => copy(inviteUrl, 'url')}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1 ${
                copied === 'url'
                  ? 'bg-brand-lime text-brand-deep border-brand-deep'
                  : 'bg-white text-brand-mid border-brand-mint hover:bg-brand-mint/40'
              }`}
            >
              {copied === 'url' ? <><LuCheck className="w-3.5 h-3.5" /> 已複製</> : <><LuCopy className="w-3.5 h-3.5" /> 複製</>}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">房間 UUID</label>
          <div className="flex items-center gap-2 bg-brand-cream border border-brand-mint rounded-2xl px-4 py-3">
            <p className="flex-1 text-sm text-brand-deep font-mono truncate">{roomId}</p>
            <button
              onClick={() => copy(roomId, 'uuid')}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1 ${
                copied === 'uuid'
                  ? 'bg-brand-lime text-brand-deep border-brand-deep'
                  : 'bg-white text-brand-mid border-brand-mint hover:bg-brand-mint/40'
              }`}
            >
              {copied === 'uuid' ? <><LuCheck className="w-3.5 h-3.5" /> 已複製</> : <><LuCopy className="w-3.5 h-3.5" /> 複製</>}
            </button>
          </div>
        </div>

        <button
          onClick={handleShareCard}
          disabled={sharing}
          className="w-full bg-brand-lime text-brand-deep font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:brightness-95 transition disabled:opacity-60 mb-4"
        >
          <LuShare2 className="w-4 h-4" />
          {sharing ? '開啟選擇器...' : '傳送邀請卡片到 LINE'}
        </button>

        <p className="text-center text-brand-mid/60 text-xs">成員在「加入房間」貼上連結或 UUID 即可</p>
      </div>
    </div>
  )
}
