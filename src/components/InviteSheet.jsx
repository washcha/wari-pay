import { useState } from 'react'
import { LuX, LuCopy, LuCheck, LuShare2, LuChevronDown } from 'react-icons/lu'
import { shareInviteCard } from '../lib/liff'

const LIFF_ID = import.meta.env.VITE_LIFF_ID

export default function InviteSheet({ roomId, roomName, onClose }) {
  const inviteUrl = LIFF_ID && LIFF_ID !== 'your-liff-id-here'
    ? `https://liff.line.me/${LIFF_ID}?join=${roomId}`
    : `${window.location.origin}/?join=${roomId}`
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleShareCard = async () => {
    setSharing(true)
    const ok = await shareInviteCard(roomName, inviteUrl)
    setSharing(false)
    if (!ok) copyUrl()
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch {
      const el = document.createElement('textarea')
      el.value = inviteUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-[32px] w-full max-w-[480px] p-6">
        <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-brand-deep">邀請成員</h2>
          <button onClick={onClose} className="text-brand-mid/60 hover:text-brand-deep w-8 h-8 flex items-center justify-center">
            <LuX className="w-5 h-5" />
          </button>
        </div>
        <p className="text-brand-mid/70 text-sm mb-5">點連結後用 LINE 登入，自動加入房間</p>

        {/* 主要 CTA：LINE 分享 */}
        <button
          onClick={handleShareCard}
          disabled={sharing}
          className="w-full bg-brand-lime text-brand-deep font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:brightness-95 transition disabled:opacity-60 mb-3"
        >
          <LuShare2 className="w-5 h-5" />
          {sharing ? '開啟選擇器...' : '傳送邀請到 LINE'}
        </button>

        {/* 次要 CTA：複製連結 */}
        <button
          onClick={copyUrl}
          className={`w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 border transition mb-5 ${
            copied
              ? 'bg-brand-mint text-brand-deep border-brand-deep'
              : 'bg-white text-brand-mid border-brand-mint hover:bg-brand-mint/30'
          }`}
        >
          {copied ? <><LuCheck className="w-4 h-4" /> 已複製連結</> : <><LuCopy className="w-4 h-4" /> 複製邀請連結</>}
        </button>

        {/* 進階：UUID（隱藏） */}
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-center gap-1 text-xs text-brand-mid/50 mb-2"
        >
          <LuChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          {showAdvanced ? '收起' : '顯示房間 ID'}
        </button>
        {showAdvanced && (
          <div className="flex items-center gap-2 bg-brand-cream border border-brand-mint rounded-2xl px-4 py-3">
            <p className="flex-1 text-xs text-brand-mid font-mono truncate">{roomId}</p>
          </div>
        )}
      </div>
    </div>
  )
}
