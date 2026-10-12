import { useState, useEffect } from 'react'
import { LuEllipsisVertical, LuPencil, LuTrash2, LuPlus, LuCheck } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import AddExpenseModal from '../components/AddExpenseModal'
import waripayLoading from '../assets/waripay_loading.png'
import waripayNoExpense from '../assets/waripay-noexpense.png'

const CAT = {
  food:          { labelKey: 'expenses.categoryFood', emoji: '🍜' },
  clothing:      { labelKey: 'expenses.categoryClothing', emoji: '👕' },
  housing:       { labelKey: 'expenses.categoryHousing', emoji: '🏠' },
  transport:     { labelKey: 'expenses.categoryTransport', emoji: '🚌' },
  entertainment: { labelKey: 'expenses.categoryEntertainment', emoji: '🎮' },
  other:         { labelKey: 'expenses.categoryOther', emoji: '📦' },
  // 舊資料 backward compatibility
  utilities:     { labelKey: 'expenses.categoryUtilities', emoji: '💡' },
  groceries:     { labelKey: 'expenses.categoryGroceries', emoji: '🛒' },
  supplies:      { labelKey: 'expenses.categorySupplies', emoji: '🧴' },
  rent:          { labelKey: 'expenses.categoryRent',     emoji: '🏠' },
}

const CURRENCY_SYMBOLS = {
  TWD: 'NT$', JPY: '¥', USD: 'US$', EUR: '€', HKD: 'HK$',
  KRW: '₩', THB: '฿', SGD: 'S$', AUD: 'A$', GBP: '£',
}
const sym = (code) => CURRENCY_SYMBOLS[code] || code || 'NT$'

const getPositivePayers = (expense) =>
  expense.expense_payers?.filter(payer => parseFloat(payer.amount_paid || 0) > 0) || []

const isMultiPayerExpense = (expense) => getPositivePayers(expense).length > 1

const getExpensePaidBy = (expense, userId) => {
  const payers = getPositivePayers(expense)
  if (payers.length > 0) {
    return payers
      .filter(payer => payer.user_id === userId)
      .reduce((sum, payer) => sum + parseFloat(payer.amount_paid || 0), 0)
  }
  return expense.paid_by === userId ? parseFloat(expense.amount || 0) : 0
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ExpensesTab({ roomId, members, activeMembers = members, roomCurrency = 'TWD' }) {
  const { user, t, language } = useApp()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [activeMenu, setActiveMenu] = useState(null)
  const [month, setMonth] = useState(currentMonth)
  const [displayRate, setDisplayRate] = useState(1)
  const [settledAt, setSettledAt] = useState(null)

  useEffect(() => { fetchExpenses() }, [roomId, month])
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

  const fetchExpenses = async () => {
    setLoading(true)
    if (import.meta.env.DEV && roomId.startsWith('local-demo-')) {
      const localExpenses = JSON.parse(localStorage.getItem(`roomiepay_demo_expenses_${roomId}`) || '[]')
      setExpenses(localExpenses)
      setSettledAt(null)
      setLoading(false)
      return
    }

    const [year, m] = month.split('-')
    const start = `${year}-${m}-01`
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
    const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`

    const [{ data }, { data: payments }] = await Promise.all([
      supabase
        .from('expenses')
        .select('*, users!paid_by(id, display_name, picture_url), expense_splits(user_id, split_amount), expense_payers(user_id, amount_paid)')
        .eq('room_id', roomId)
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date', { ascending: false }),
      supabase
        .from('settlement_payments')
        .select('created_at')
        .eq('room_id', roomId)
        .eq('month', month),
    ])

    setExpenses(data || [])
    setSettledAt((payments || []).reduce((latest, payment) => {
      if (!latest || new Date(payment.created_at) > new Date(latest)) return payment.created_at
      return latest
    }, null))
    setLoading(false)
  }

  const isExpenseLocked = (expense) => settledAt && new Date(expense.created_at) <= new Date(settledAt)

  const deleteExpense = async (expense) => {
    if (isExpenseLocked(expense)) return
    if (!window.confirm(t('expenses.deleteConfirm'))) return
    setActiveMenu(null)
    if (import.meta.env.DEV && roomId.startsWith('local-demo-')) {
      const key = `roomiepay_demo_expenses_${roomId}`
      const localExpenses = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify(localExpenses.filter(item => item.id !== expense.id)))
      fetchExpenses()
      return
    }
    const { error: payerError } = await supabase.from('expense_payers').delete().eq('expense_id', expense.id)
    const { error: splitError } = await supabase.from('expense_splits').delete().eq('expense_id', expense.id)
    const { error: expenseError } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (payerError || splitError || expenseError) {
      alert(expenseError?.message || splitError?.message || payerError?.message || 'Delete failed')
      return
    }
    fetchExpenses()
  }

  // All totals in TWD equivalent
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount) * parseFloat(e.exchange_rate || 1), 0)
  const myPaid = expenses
    .reduce((s, e) => s + getExpensePaidBy(e, user.id) * parseFloat(e.exchange_rate || 1), 0)
  const roomSymbol = sym(roomCurrency)
  const displayTotal = total * displayRate
  const displayMyPaid = myPaid * displayRate
  const fmt = (amount) => Number(amount).toLocaleString(language)
  const fmtRounded = (amount) => Math.round(amount).toLocaleString(language)

  // 依 expense_date 分組（資料庫已按日期 desc 排序）
  const dateGroups = []
  let currentDate = null
  expenses.forEach(e => {
    if (e.expense_date !== currentDate) {
      currentDate = e.expense_date
      dateGroups.push({ date: currentDate, items: [] })
    }
    dateGroups[dateGroups.length - 1].items.push(e)
  })

  const formatDateHeader = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const weekdays = t('expenses.weekdays').split(',')
    const dow = new Date(y, m - 1, d).getDay()
    return t('expenses.dateHeader', { month: m, day: d, weekday: weekdays[dow] })
  }

  return (
    <div className="pb-24">
      <div className="bg-white px-4 py-3 shadow-card sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-sm text-brand-deep border border-brand-mint rounded-xl px-2 py-1"
          />
          <div className="text-right">
            <p className="text-xs text-brand-mid/60">{t('expenses.monthlyTotal', { currency: t(`expenses.currency${roomCurrency}`) || roomCurrency })}</p>
            <p className="font-bold text-brand-deep text-[28px] leading-tight">{roomSymbol} {fmtRounded(displayTotal)}</p>
            <p className="text-xs text-brand-mid/60">{t('expenses.myPaid', { symbol: roomSymbol, amount: fmtRounded(displayMyPaid) })}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><img src={waripayLoading} alt="loading" className="w-20 h-20 animate-bounce" /></div>
        ) : expenses.length === 0 ? (
          <div className="py-14">
            <div className="bg-white rounded-[32px] shadow-card border border-brand-mint/60 px-5 py-7 text-center overflow-hidden relative">
              <div className="absolute -top-12 -right-12 w-28 h-28 bg-brand-lime/25 rounded-full" />
              <div className="absolute -bottom-16 -left-10 w-36 h-36 bg-brand-mint/45 rounded-full" />
              <div className="relative">
                <img src={waripayNoExpense} alt={t('expenses.emptyTitle')} className="w-28 h-28 mx-auto mb-4" />
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-brand-mid/55 mb-2">
                  {t('expenses.emptyEyebrow')}
                </p>
                <h2 className="text-brand-deep text-2xl font-bold leading-tight">
                  {t('expenses.emptyTitle')}
                </h2>
                <p className="text-brand-mid/75 text-sm leading-relaxed mt-3 max-w-[300px] mx-auto">
                  {t('expenses.emptyHint')}
                </p>
                <button
                  onClick={() => setShowAdd(true)}
                  className="mt-6 w-full bg-brand-lime text-brand-deep font-bold py-4 rounded-2xl text-lg shadow-soft hover:brightness-95 active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <LuPlus className="w-5 h-5 stroke-[2.5]" />
                  {t('expenses.emptyCta')}
                </button>
                <p className="text-brand-mid/55 text-xs mt-3">
                  {t('expenses.emptySecondaryHint')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          dateGroups.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-2 mb-2 mt-1 px-1">
                <span className="text-xs font-semibold text-brand-mid tracking-wide">
                  {formatDateHeader(group.date)}
                </span>
                <div className="flex-1 h-px bg-brand-mint/60" />
              </div>

              <div className="space-y-3">
                {group.items.map(expense => {
                  const cat = CAT[expense.category] || CAT.other
                  const myPaidAmount = getExpensePaidBy(expense, user.id)
                  const paidByMe = myPaidAmount > 0
                  const myShare = expense.expense_splits?.find(s => s.user_id === user.id)
                  const currency = sym(expense.currency)
                  const rate = parseFloat(expense.exchange_rate || 1)
                  const isDifferentFromRoom = expense.currency && expense.currency !== roomCurrency
                  const twdEquiv = parseFloat(expense.amount) * rate
                  const roomEquiv = twdEquiv * displayRate
                  const isMultiPayer = isMultiPayerExpense(expense)
                  const isLocked = isExpenseLocked(expense)

                  return (
                    <div key={expense.id} className="bg-white rounded-3xl p-4 shadow-card relative">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 bg-brand-mint rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                          {cat.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-brand-deep truncate">{expense.title}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <div className="text-right">
                                <p className={`font-bold text-lg leading-tight ${paidByMe ? 'text-brand-deep' : 'text-brand-mid'}`}>
                                  {currency} {fmt(parseFloat(expense.amount))}
                                </p>
                                {isDifferentFromRoom && (
                                  <p className="text-xs text-brand-mid/60">≈ {roomSymbol} {fmtRounded(roomEquiv)}</p>
                                )}
                              </div>
                              <button
                                onClick={() => setActiveMenu(activeMenu === expense.id ? null : expense.id)}
                                className="text-brand-mid/60 w-7 h-7 flex items-center justify-center rounded-full hover:bg-brand-mint/60"
                              >
                                <LuEllipsisVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-brand-deep bg-brand-mint px-2 py-0.5 rounded-full">{t(cat.labelKey)}</span>
                            <span className={`text-xs flex items-center gap-1 ${paidByMe ? 'text-brand-deep font-medium' : 'text-brand-mid/70'}`}>
                              {paidByMe && <LuCheck className="w-3 h-3" />}
                              {isMultiPayer
                                ? t('addExpense.multiplePayment')
                                : paidByMe ? t('expenses.paidByMe') : t('expenses.paidByUser', { name: expense.users?.display_name })}
                            </span>
                          </div>

                          {myShare && (
                            <p className="text-xs text-brand-deep mt-1.5 font-medium">
                              {t('expenses.myShare', { currency, amount: fmt(parseFloat(myShare.split_amount)) })}
                              {isDifferentFromRoom && (
                                <span className="text-brand-mid/60 font-normal ml-1">
                                  ≈ {roomSymbol} {fmtRounded(parseFloat(myShare.split_amount) * rate * displayRate)}
                                </span>
                              )}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1 mt-2">
                            {isMultiPayer && getPositivePayers(expense).map(payer => {
                              const mb = members.find(mb => mb.id === payer.user_id)
                              return mb ? (
                                <span key={`payer-${payer.user_id}`} className="text-xs text-brand-deep bg-brand-mint border border-brand-deep/10 px-2 py-0.5 rounded-full">
                                  {mb.display_name.split(' ')[0]} {t('addExpense.paidVerb')} {currency}{fmt(parseFloat(payer.amount_paid))}
                                </span>
                              ) : null
                            })}
                            {expense.expense_splits?.map(split => {
                              const mb = members.find(mb => mb.id === split.user_id)
                              return mb ? (
                                <span key={split.user_id} className="text-xs text-brand-mid bg-brand-cream border border-brand-mint px-2 py-0.5 rounded-full">
                                  {mb.display_name.split(' ')[0]} {currency}{fmt(parseFloat(split.split_amount))}
                                </span>
                              ) : null
                            })}
                          </div>

                          {expense.note && (
                            <p className="text-xs text-brand-mid/70 mt-1.5 italic">📌 {expense.note}</p>
                          )}
                        </div>
                      </div>

                      {activeMenu === expense.id && (
                        <div className="absolute right-4 top-12 bg-white rounded-2xl shadow-soft border border-brand-mint z-30 overflow-hidden">
                          <button
                            disabled={isLocked}
                            onClick={() => { setEditExpense(expense); setActiveMenu(null) }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-brand-deep hover:bg-brand-mint/50"
                          >
                            <LuPencil className="w-4 h-4" /> {t('expenses.edit')}
                          </button>
                          <button
                            disabled={isLocked}
                            onClick={() => deleteExpense(expense)}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50"
                          >
                            <LuTrash2 className="w-4 h-4" /> {t('expenses.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-8 right-4 w-14 h-14 bg-brand-lime text-brand-deep rounded-full shadow-soft flex items-center justify-center hover:brightness-95 active:scale-95 transition z-20"
        style={{ maxWidth: 'calc(480px - 2rem)' }}
      >
        <LuPlus className="w-7 h-7 stroke-[2.5]" />
      </button>

      {activeMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setActiveMenu(null)} />
      )}

      {showAdd && (
        <AddExpenseModal
          roomId={roomId}
          members={activeMembers}
          defaultCurrency={roomCurrency}
          roomCurrency={roomCurrency}
          onClose={() => setShowAdd(false)}
          onAdded={(savedDate) => {
            setShowAdd(false)
            const savedMonth = savedDate?.slice(0, 7)
            if (savedMonth && savedMonth !== month) {
              setMonth(savedMonth) // useEffect 會自動重新 fetch
            } else {
              fetchExpenses()
            }
          }}
        />
      )}

      {editExpense && (
        <AddExpenseModal
          roomId={roomId}
          members={members}
          expense={editExpense}
          defaultCurrency={roomCurrency}
          roomCurrency={roomCurrency}
          onClose={() => setEditExpense(null)}
          onAdded={(savedDate) => {
            const savedMonth = savedDate?.slice(0, 7)
            setEditExpense(null)
            if (savedMonth && savedMonth !== month) {
              setMonth(savedMonth)
            } else {
              fetchExpenses()
            }
          }}
        />
      )}
    </div>
  )
}
