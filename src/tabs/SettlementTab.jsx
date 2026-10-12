import { useState, useEffect, Fragment } from 'react'
import { LuCheck, LuHandCoins, LuCopy, LuClock } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import Avatar from '../components/Avatar'
import SettlePaymentModal from '../components/SettlePaymentModal'
import waripayLoading from '../assets/waripay_loading.png'

const CURRENCY_SYMBOLS = {
  TWD: 'NT$',
  USD: 'US$',
  JPY: '¥',
  KRW: '₩',
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const addPaidAmount = (paid, expense, rate) => {
  if (expense.expense_payers?.length > 0) {
    expense.expense_payers.forEach(payer => {
      if (paid[payer.user_id] !== undefined) paid[payer.user_id] += parseFloat(payer.amount_paid || 0) * rate
    })
    return
  }
  const twdAmt = parseFloat(expense.amount) * rate
  if (paid[expense.paid_by] !== undefined) paid[expense.paid_by] += twdAmt
}

export default function SettlementTab({ roomId, members, roomCurrency = 'TWD' }) {
  const { user, t, language } = useApp()
  const [balances, setBalances] = useState([])
  const [payments, setPayments] = useState([])
  const [rawData, setRawData] = useState({ expenses: [], splits: [], expRateMap: {} })
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth)
  const [settlingCard, setSettlingCard] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [displayRate, setDisplayRate] = useState(1)

  const symbol = CURRENCY_SYMBOLS[roomCurrency] || roomCurrency || 'NT$'
  const toDisplay = (twdAmount) => twdAmount * displayRate
  const formatDisplayAmount = (twdAmount) => Math.round(toDisplay(twdAmount)).toLocaleString(language)
  const formatRawAmount = (amount) => Math.round(amount).toLocaleString(language)

  useEffect(() => {
    const fetchDisplayRate = async () => {
      if (!roomCurrency || roomCurrency === 'TWD') {
        setDisplayRate(1)
        return
      }
      try {
        const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json')
        const data = await res.json()
        setDisplayRate(data.twd?.[roomCurrency.toLowerCase()] || 1)
      } catch {
        setDisplayRate(1)
      }
    }
    fetchDisplayRate()
  }, [roomCurrency])

  const copyReminder = (member) => {
    const [year, m] = month.split('-')
    const msg = t('settlement.reminderText', {
      name: member.display_name,
      year,
      month: parseInt(m),
      symbol,
      amount: formatDisplayAmount(Math.abs(member.balance)),
    })
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

    let expenses = []
    let paymentsData = []
    if (import.meta.env.DEV && roomId.startsWith('local-demo-')) {
      expenses = JSON.parse(localStorage.getItem(`roomiepay_demo_expenses_${roomId}`) || '[]')
        .filter(expense => expense.expense_date >= start && expense.expense_date <= end)
    } else {
      const [{ data: expensesData }, { data: payments }] = await Promise.all([
        supabase.from('expenses').select('id, paid_by, amount, exchange_rate, created_at, expense_payers(user_id, amount_paid)').eq('room_id', roomId).gte('expense_date', start).lte('expense_date', end),
        supabase.from('settlement_payments').select('*').eq('room_id', roomId).eq('month', month),
      ])
      expenses = expensesData || []
      paymentsData = payments || []
    }

    const ids = expenses?.map(e => e.id) || []
    let splits = []
    if (import.meta.env.DEV && roomId.startsWith('local-demo-')) {
      splits = expenses.flatMap(expense => expense.expense_splits || [])
    } else if (ids.length > 0) {
      const { data } = await supabase.from('expense_splits').select('expense_id, user_id, split_amount').in('expense_id', ids)
      splits = data || []
    }

    const expRateMap = {}
    expenses?.forEach(e => { expRateMap[e.id] = parseFloat(e.exchange_rate || 1) })

    const paid = Object.fromEntries(members.map(mb => [mb.id, 0]))
    const owed = Object.fromEntries(members.map(mb => [mb.id, 0]))

    expenses?.forEach(e => addPaidAmount(paid, e, parseFloat(e.exchange_rate || 1)))

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
      if (e.expense_payers?.length > 0) {
        e.expense_payers.forEach(payer => {
          if (payer.user_id === memberId) newPaid += parseFloat(payer.amount_paid || 0) * (rawData.expRateMap[e.id] || 1)
        })
      } else {
        const twdAmt = parseFloat(e.amount) * (rawData.expRateMap[e.id] || 1)
        if (e.paid_by === memberId) newPaid += twdAmt
      }
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
          <h3 className="font-bold text-brand-deep">{t('settlement.title')}</h3>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-sm bg-white/60 text-brand-deep border border-brand-mid/40 rounded-xl px-2 py-1"
          />
        </div>
        <div className="text-center">
          <p className="text-brand-mid text-xs uppercase tracking-widest">{t('settlement.monthlyTotal', { currency: t(`expenses.currency${roomCurrency}`) || roomCurrency })}</p>
          <p className="text-4xl font-bold text-brand-deep mt-1">{symbol} {formatDisplayAmount(roomTotal)}</p>
        </div>
        {myBalance && Math.abs(myBalance.balance) >= 1 && (
          <div className={`mt-4 p-3 rounded-2xl text-sm text-center font-medium ${
            myBalance.balance > 0
              ? 'bg-brand-lime text-brand-deep'
              : 'bg-white text-red-600'
          }`}>
            {myBalance.balance > 0
              ? t('settlement.myCredit', { symbol, amount: formatDisplayAmount(myBalance.balance) })
              : t('settlement.myDebt', { symbol, amount: formatDisplayAmount(Math.abs(myBalance.balance)) })}
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

            if (hasNewDebt) {
              return (
                <Fragment key={b.id}>
                  <div className={`rounded-3xl p-4 ${isMe ? 'bg-white shadow-card' : 'bg-[#E9E9E9]'}`}>
                    <div className="flex items-center gap-3">
                      <Avatar src={b.picture_url} name={b.display_name} userId={b.id} className="w-10 h-10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-brand-deep truncate">{b.display_name}</p>
                          {isMe && <span className="text-xs bg-brand-mint text-brand-deep px-2 py-0.5 rounded-full flex-shrink-0">{t('settlement.me')}</span>}
                        </div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs text-brand-mid/70">{t('settlement.paid', { symbol, amount: formatDisplayAmount(b.paid) })}</span>
                          <span className="text-xs text-brand-mid/70">{t('settlement.owed', { symbol, amount: formatDisplayAmount(b.owed) })}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 text-brand-mid/50">
                        <p className="font-bold text-xl">±0</p>
                        <p className="text-xs">{t('settlement.settled')}</p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-brand-mint/60 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand-deep flex items-center gap-1">
                          <LuCheck className="w-3.5 h-3.5" /> {t('settlement.recordedSettled', { symbol, amount: formatRawAmount(payment.amount) })}
                        </span>
                        <span className="text-xs text-brand-mid/50">
                          {new Date(payment.created_at).toLocaleDateString(language)}
                        </span>
                      </div>
                      {payment.note && <p className="text-xs text-brand-mid mt-1">{payment.note}</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl p-4 bg-red-50 border border-red-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <LuHandCoins className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-deep">{b.display_name}</p>
                        <p className="text-xs text-brand-mid/60">{t('settlement.newAfterSettled')}</p>
                      </div>
                      <div className="text-right flex-shrink-0 text-red-500">
                        <p className="font-bold text-xl">{symbol}{formatDisplayAmount(Math.abs(newDelta))}</p>
                        <p className="text-xs">{t('settlement.needPay')}</p>
                      </div>
                    </div>
                    {isMe ? (
                      <button
                        onClick={() => setSettlingCard({ ...b, balance: newDelta, isNewDebt: true })}
                        className="mt-3 w-full bg-brand-lime text-brand-deep font-semibold py-2.5 rounded-2xl text-sm hover:brightness-95 active:scale-95 transition flex items-center justify-center gap-1.5"
                      >
                        <LuHandCoins className="w-4 h-4" /> {t('settlement.settleDiff', { symbol, amount: formatDisplayAmount(Math.abs(newDelta)) })}
                      </button>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-1">
                        <LuClock className="w-3 h-3 text-orange-400" />
                        <span className="text-xs text-orange-500">{t('settlement.newPending')}</span>
                      </div>
                    )}
                  </div>
                </Fragment>
              )
            }

            return (
              <div
                key={b.id}
                className={`rounded-3xl p-4 ${isMe ? 'bg-white shadow-card' : 'bg-[#E9E9E9]'}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar src={b.picture_url} name={b.display_name} userId={b.id} className="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-brand-deep truncate">{b.display_name}</p>
                      {isMe && (
                        <span className="text-xs bg-brand-mint text-brand-deep px-2 py-0.5 rounded-full flex-shrink-0">{t('settlement.me')}</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-brand-mid/70">{t('settlement.paid', { symbol, amount: formatDisplayAmount(b.paid) })}</span>
                      <span className="text-xs text-brand-mid/70">{t('settlement.owed', { symbol, amount: formatDisplayAmount(b.owed) })}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-xl ${b.balance > 0 ? 'text-brand-deep' : b.balance < -1 ? 'text-red-500' : 'text-brand-mid/50'}`}>
                      {b.balance > 0 ? '＋' : b.balance < -1 ? '−' : '±'}{symbol}{formatDisplayAmount(Math.abs(b.balance))}
                    </p>
                    <p className="text-xs text-brand-mid/60 mt-1">
                      {b.balance > 0 ? t('settlement.receivable') : b.balance < -1 ? t('settlement.needPay') : t('settlement.settled')}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-brand-mint/60 pt-3 flex items-center justify-between">
                  {b.balance > 0 ? (
                    <button
                      onClick={() => copyReminder(b)}
                      className="text-xs text-brand-deep font-medium flex items-center gap-1.5 hover:underline"
                    >
                      <LuCopy className="w-3.5 h-3.5" />
                      {copiedId === b.id ? t('settlement.copiedReminder') : t('settlement.copyReminder')}
                    </button>
                  ) : (
                    <span className="text-xs text-brand-mid/50">{t('settlement.noReminder')}</span>
                  )}

                  {b.balance < -1 && isMe && (
                    <button
                      onClick={() => setSettlingCard({ ...b, balance: b.balance })}
                      className="bg-brand-lime text-brand-deep font-semibold px-3.5 py-2 rounded-2xl text-xs hover:brightness-95 active:scale-95 transition flex items-center gap-1.5"
                    >
                      <LuHandCoins className="w-4 h-4" /> {t('settlement.settlePayment', { symbol, amount: formatDisplayAmount(Math.abs(b.balance)) })}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {settlingCard && (
        <SettlePaymentModal
          amount={Math.abs(toDisplay(settlingCard.balance))}
          roomId={roomId}
          month={month}
          existingPayment={payments.find(p => p.payer_id === settlingCard.id)}
          advanceTimestamp={settlingCard.isNewDebt}
          currencySymbol={symbol}
          onClose={() => setSettlingCard(null)}
          onSaved={() => {
            setSettlingCard(null)
            calcSettlement()
          }}
        />
      )}
    </div>
  )
}
