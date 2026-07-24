import { useState, useEffect, Fragment } from 'react'
import { LuCheck, LuHandCoins, LuCopy, LuClock } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import SettlePaymentModal from '../components/SettlePaymentModal'
import waripayLoading from '../assets/waripay_loading.png'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function Avatar({ src, name }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=144516&color=B0EC70`
  return (
    <img
      src={src || fallback}
      alt={name}
      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      onError={e => { e.target.src = fallback }}
    />
  )
}

export default function SettlementTab({ roomId, members }) {
  const { user } = useApp()
  const [balances, setBalances] = useState([])
  const [payments, setPayments] = useState([])
  const [rawData, setRawData] = useState({ expenses: [], splits: [], expRateMap: {} })
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth)
  const [settlingCard, setSettlingCard] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const copyReminder = (member) => {
    const [year, m] = month.split('-')
    const msg = `Hi ${member.display_name}，${year}年${parseInt(m)}月費用結算 NT$${Math.round(Math.abs(member.balance)).toLocaleString()} 尚未結清，記得繳喔！`
    navigator.clipboard.writeText(msg)
    setCopiedId(member.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  useEffect(() => { calcSettlement() }, [roomId, month, members])

  const calcSettlement = async () => {
    if (members.length === 0) return
    setLoading(true)

    const [year, m] = month.split('-')
    const start = `${year}-${m}-01`
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
    const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`

    const [{ data: expenses }, { data: paymentsData }] = await Promise.all([
      supabase.from('expenses').select('id, paid_by, amount, exchange_rate, created_at').eq('room_id', roomId).gte('expense_date', start).lte('expense_date', end),
      supabase.from('settlement_payments').select('*').eq('room_id', roomId).eq('month', month),
    ])

    const ids = expenses?.map(e => e.id) || []
    let splits = []
    if (ids.length > 0) {
      const { data } = await supabase.from('expense_splits').select('expense_id, user_id, split_amount').in('expense_id', ids)
      splits = data || []
    }

    const expRateMap = {}
    expenses?.forEach(e => { expRateMap[e.id] = parseFloat(e.exchange_rate || 1) })

    const paid = Object.fromEntries(members.map(mb => [mb.id, 0]))
    const owed = Object.fromEntries(members.map(mb => [mb.id, 0]))

    expenses?.forEach(e => {
      const twdAmt = parseFloat(e.amount) * parseFloat(e.exchange_rate || 1)
      if (paid[e.paid_by] !== undefined) paid[e.paid_by] += twdAmt
    })

    splits.forEach(s => {
      const twdAmt = parseFloat(s.split_amount) * (expRateMap[s.expense_id] || 1)
      if (owed[s.user_id] !== undefined) owed[s.user_id] += twdAmt
    })

    const result = members
      .map(mb => ({
        ...mb,
        paid: paid[mb.id] || 0,
        owed: owed[mb.id] || 0,
        balance: (paid[mb.id] || 0) - (owed[mb.id] || 0),
      }))
      .sort((a, b) => {
        if (a.id === user.id) return -1
        if (b.id === user.id) return 1
        return b.balance - a.balance
      })

    setRawData({ expenses: expenses || [], splits, expRateMap })
    setPayments(paymentsData || [])
    setBalances(result)
    setLoading(false)
  }

  const getNewDelta = (memberId, settledAt) => {
    const cutoff = new Date(settledAt)
    const newExpIds = new Set(
      rawData.expenses
        .filter(e => new Date(e.created_at) > cutoff)
        .map(e => e.id)
    )
    if (newExpIds.size === 0) return 0

    let newPaid = 0
    let newOwed = 0
    rawData.expenses.forEach(e => {
      if (!newExpIds.has(e.id)) return
      const twdAmt = parseFloat(e.amount) * (rawData.expRateMap[e.id] || 1)
      if (e.paid_by === memberId) newPaid += twdAmt
    })
    rawData.splits.forEach(s => {
      if (!newExpIds.has(s.expense_id)) return
      const twdAmt = parseFloat(s.split_amount) * (rawData.expRateMap[s.expense_id] || 1)
      if (s.user_id === memberId) newOwed += twdAmt
    })

    return newPaid - newOwed
  }

  const roomTotal = balances.reduce((s, b) => s + b.paid, 0)
  const myBalance = balances.find(b => b.id === user.id)

  return (
    <div className="p-4 pb-24">
      <div className="bg-[#F3FDD3] rounded-3xl p-5 shadow-soft mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-brand-deep">月份結算</h3>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-sm bg-white/60 text-brand-deep border border-brand-mid/40 rounded-xl px-2 py-1"
          />
        </div>
        <div className="text-center">
          <p className="text-brand-mid text-xs uppercase tracking-widest">Total this month</p>
          <p className="text-4xl font-bold text-brand-deep mt-1">NT$ {Math.round(roomTotal).toLocaleString()}</p>
        </div>
        {myBalance && Math.abs(myBalance.balance) >= 1 && (
          <div className={`mt-4 p-3 rounded-2xl text-sm text-center font-medium ${
            myBalance.balance > 0
              ? 'bg-brand-lime text-brand-deep'
              : 'bg-white text-red-600'
          }`}>
            {myBalance.balance > 0
              ? `🎉 你本月幫大家墊了 NT$${Math.round(myBalance.balance).toLocaleString()}，可以跟成員收回`
              : `💸 你需要補繳 NT$${Math.round(Math.abs(myBalance.balance)).toLocaleString()} 給成員`}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><img src={waripayLoading} alt="loading" className="w-20 h-20 animate-bounce" /></div>
      ) : (
        <div className="space-y-3">
          {balances.map(b => {
            const isMe = b.id === user.id
            const pos = b.balance > 0
            const zero = Math.abs(b.balance) < 1
            const payment = payments.find(p => p.payer_id === b.id)

            const newDelta = (!pos && !zero && payment) ? getNewDelta(b.id, payment.created_at) : 0
            const hasNewDebt = newDelta < -1
            const settled = !!payment && !pos && !zero && !hasNewDebt

            // 已結清後又有新帳 → 拆成兩張獨立卡片
            if (hasNewDebt) {
              return (
                <Fragment key={b.id}>
                  {/* 卡片一：已結清部分 */}
                  <div className={`rounded-3xl p-4 ${isMe ? 'bg-white shadow-card' : 'bg-[#E9E9E9]'}`}>
                    <div className="flex items-center gap-3">
                      <Avatar src={b.picture_url} name={b.display_name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-brand-deep truncate">{b.display_name}</p>
                          {isMe && <span className="text-xs bg-brand-mint text-brand-deep px-2 py-0.5 rounded-full flex-shrink-0">你</span>}
                        </div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs text-brand-mid/70">付出 NT${Math.round(b.paid).toLocaleString()}</span>
                          <span className="text-xs text-brand-mid/70">應出 NT${Math.round(b.owed).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 text-brand-mid/50">
                        <p className="font-bold text-xl">±0</p>
                        <p className="text-xs">已結清</p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-brand-mint/60 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand-deep flex items-center gap-1">
                          <LuCheck className="w-3.5 h-3.5" /> 已記錄結清 NT${Math.round(payment.amount).toLocaleString()}
                        </span>
                        <span className="text-xs text-brand-mid/50">
                          {new Date(payment.created_at).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                      {payment.note && <p className="text-xs text-brand-mid mt-1">{payment.note}</p>}
                    </div>
                  </div>

                  {/* 卡片二：結清後新增的差額 */}
                  <div className="rounded-3xl p-4 bg-red-50 border border-red-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <LuHandCoins className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-deep">{b.display_name}</p>
                        <p className="text-xs text-brand-mid/60">結清後新增帳目</p>
                      </div>
                      <div className="text-right flex-shrink-0 text-red-500">
                        <p className="font-bold text-xl">NT${Math.round(Math.abs(newDelta)).toLocaleString()}</p>
                        <p className="text-xs">需補繳</p>
                      </div>
                    </div>
                    {isMe ? (
                      <button
                        onClick={() => setSettlingCard({ ...b, balance: newDelta, isNewDebt: true })}
                        className="mt-3 w-full bg-brand-lime text-brand-deep font-semibold py-2.5 rounded-2xl text-sm hover:brightness-95 active:scale-95 transition flex items-center justify-center gap-1.5"
                      >
                        <LuHandCoins className="w-4 h-4" /> 結清差額 NT${Math.round(Math.abs(newDelta)).toLocaleString()}
                      </button>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-1">
                        <LuClock className="w-3 h-3 text-orange-400" />
                        <span className="text-xs text-orange-500">有新帳目待結清</span>
                      </div>
                    )}
                  </div>
                </Fragment>
              )
            }

            // 一般卡片
            return (
              <div
                key={b.id}
                className={`rounded-3xl p-4 ${isMe ? 'bg-white shadow-card' : 'bg-[#E9E9E9]'}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar src={b.picture_url} name={b.display_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-brand-deep truncate">{b.display_name}</p>
                      {isMe && (
                        <span className="text-xs bg-brand-mint text-brand-deep px-2 py-0.5 rounded-full flex-shrink-0">你</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-brand-mid/70">付出 NT${Math.round(b.paid).toLocaleString()}</span>
                      <span className="text-xs text-brand-mid/70">應出 NT${Math.round(b.owed).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className={`text-right flex-shrink-0 ${
                    zero || settled ? 'text-brand-mid/50' : pos ? 'text-brand-deep' : 'text-red-500'
                  }`}>
                    <p className="font-bold text-xl">
                      {zero || settled
                        ? '±0'
                        : pos
                          ? `+NT$${Math.round(b.balance).toLocaleString()}`
                          : `NT$${Math.round(Math.abs(b.balance)).toLocaleString()}`}
                    </p>
                    <p className="text-xs">{zero || settled ? '已結清' : pos ? '可收回' : '需補繳'}</p>
                  </div>
                </div>

                {payment && (
                  <div className="mt-3 border-t border-brand-mint/60 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-deep flex items-center gap-1">
                        <LuCheck className="w-3.5 h-3.5" /> 已記錄結清
                      </span>
                      {isMe && (
                        <button onClick={() => setSettlingCard(b)} className="text-xs text-brand-mid underline">更新</button>
                      )}
                    </div>
                    {payment.note && <p className="text-xs text-brand-mid mt-1">{payment.note}</p>}
                    <p className="text-xs text-brand-mid/50 mt-0.5">
                      {new Date(payment.created_at).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                )}

                {!zero && !pos && !isMe && !payment && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-brand-mid/50 flex items-center gap-1">
                      <LuClock className="w-3 h-3" /> 尚未結清
                    </span>
                    <button onClick={() => copyReminder(b)} className="text-xs text-brand-mid flex items-center gap-1.5">
                      {copiedId === b.id
                        ? <><LuCheck className="w-3 h-3 text-brand-deep" /><span className="text-brand-deep">已複製</span></>
                        : <><LuCopy className="w-3 h-3" /> 複製提醒訊息</>}
                    </button>
                  </div>
                )}

                {!zero && !pos && isMe && !payment && (
                  <button
                    onClick={() => setSettlingCard(b)}
                    className="mt-3 w-full bg-brand-lime text-brand-deep font-semibold py-2.5 rounded-2xl text-sm hover:brightness-95 active:scale-95 transition flex items-center justify-center gap-1.5"
                  >
                    <LuHandCoins className="w-4 h-4" /> 結清款項
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {settlingCard && (
        <SettlePaymentModal
          amount={Math.round(Math.abs(settlingCard.balance))}
          roomId={roomId}
          month={month}
          existingPayment={settlingCard.isNewDebt ? null : payments.find(p => p.payer_id === user.id)}
          advanceTimestamp={!!settlingCard.isNewDebt}
          onClose={() => setSettlingCard(null)}
          onSaved={() => { setSettlingCard(null); calcSettlement() }}
        />
      )}
    </div>
  )
}
