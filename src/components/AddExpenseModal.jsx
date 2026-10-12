import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { LuX, LuCheck, LuPencilLine, LuChevronDown } from 'react-icons/lu'
import { hasAuthToken, supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { sendExpenseMessage } from '../lib/liff'
import Avatar from './Avatar'

const CATEGORIES = [
  { key: 'food',          labelKey: 'expenses.categoryFood', emoji: '🍜' },
  { key: 'clothing',      labelKey: 'expenses.categoryClothing', emoji: '👕' },
  { key: 'housing',       labelKey: 'expenses.categoryHousing', emoji: '🏠' },
  { key: 'transport',     labelKey: 'expenses.categoryTransport', emoji: '🚌' },
  { key: 'entertainment', labelKey: 'expenses.categoryEntertainment', emoji: '🎮' },
  { key: 'other',         labelKey: 'expenses.categoryOther', emoji: '📦' },
]

const CURRENCIES = [
  { code: 'TWD', symbol: 'NT$', label: '台幣' },
  { code: 'JPY', symbol: '¥',   label: '日圓' },
  { code: 'USD', symbol: 'US$', label: '美元' },
  { code: 'EUR', symbol: '€',   label: '歐元' },
  { code: 'HKD', symbol: 'HK$', label: '港幣' },
  { code: 'KRW', symbol: '₩',   label: '韓圓' },
  { code: 'THB', symbol: '฿',   label: '泰銖' },
  { code: 'SGD', symbol: 'S$',  label: '新幣' },
  { code: 'AUD', symbol: 'A$',  label: '澳幣' },
  { code: 'GBP', symbol: '£',   label: '英鎊' },
]

const CURRENCY_SYMBOLS = Object.fromEntries(CURRENCIES.map(c => [c.code, c.symbol]))
const sym = (code) => CURRENCY_SYMBOLS[code] || code || 'NT$'

const getPositivePayers = (expense) =>
  expense?.expense_payers?.filter(payer => parseFloat(payer.amount_paid || 0) > 0) || []

const hasMultiplePayers = (expense) => getPositivePayers(expense).length > 1

const buildInitialPayerRows = (members, expense, userId) => {
  const savedPayers = getPositivePayers(expense)
  if (savedPayers.length > 0) {
    const rows = savedPayers.map(payer => ({
      userId: payer.user_id,
      amount: payer.amount_paid ? String(payer.amount_paid) : '',
    }))
    if (rows.length > 1) return rows

    const firstUserId = rows[0]?.userId || expense?.paid_by || userId
    return [
      rows[0],
      { userId: members.find(m => m.id !== firstUserId)?.id || '', amount: '' },
    ]
  }
  return [
    { userId: expense?.paid_by || userId, amount: expense?.amount ? String(expense.amount) : '' },
    { userId: members.find(m => m.id !== (expense?.paid_by || userId))?.id || '', amount: '' },
  ]
}

export default function AddExpenseModal({ roomId, members, onClose, onAdded, expense = null, defaultCurrency = 'TWD', roomCurrency = 'TWD' }) {
  const { user, t, language } = useApp()
  const isEdit = !!expense
  const [form, setForm] = useState({
    title: expense?.title || '',
    amount: expense?.amount ? String(expense.amount) : '',
    category: expense?.category || 'other',
    currency: expense?.currency || defaultCurrency,
    exchangeRate: expense?.exchange_rate ? String(expense.exchange_rate) : '1',
    paidBy: expense?.paid_by || user.id,
    paymentMode: hasMultiplePayers(expense) ? 'multiple' : 'single',
    payerRows: buildInitialPayerRows(members, expense, user.id),
    splitAmong: expense?.expense_splits?.map(s => s.user_id) || members.map(m => m.id),
    note: expense?.note || '',
    date: expense?.expense_date || new Date().toISOString().split('T')[0],
  })
  const [loading, setLoading] = useState(false)
  const [rateFetching, setRateFetching] = useState(false)
  const [error, setError] = useState(null)
  const [liveRate, setLiveRate] = useState(
    expense?.exchange_rate ? String(expense.exchange_rate) : '1'
  )
  const [rateEditing, setRateEditing] = useState(false)
  const [roomDisplayRate, setRoomDisplayRate] = useState(1)

  const selectedCurrency = CURRENCIES.find(c => c.code === form.currency) || CURRENCIES[0]
  const roomSymbol = sym(roomCurrency)
  const roomLabel = t(`expenses.currency${roomCurrency}`) || roomCurrency
  const parsedAmount = parseFloat(form.amount || 0)
  const parsedRate = parseFloat(form.exchangeRate || 1)
  const twdEquiv = parsedAmount * parsedRate
  const roomEquiv = twdEquiv * roomDisplayRate
  const perPerson = form.splitAmong.length > 0
    ? (parsedAmount / form.splitAmong.length).toFixed(0)
    : 0
  const perPersonTwd = form.splitAmong.length > 0
    ? (twdEquiv / form.splitAmong.length).toFixed(0)
    : 0
  const perPersonRoom = form.splitAmong.length > 0
    ? (roomEquiv / form.splitAmong.length).toFixed(0)
    : 0
  const fmt = (amount) => Number(amount).toLocaleString(language)
  const fmtRounded = (amount) => Math.round(amount).toLocaleString(language)
  const payerTotal = form.payerRows
    .reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)
  const payerDiff = parsedAmount - payerTotal
  const usedPayerIds = form.payerRows.map(row => row.userId).filter(Boolean)
  const canAddPayer = usedPayerIds.length < members.length

  useEffect(() => {
    const fetchRoomDisplayRate = async () => {
      if (!roomCurrency || roomCurrency === 'TWD') {
        setRoomDisplayRate(1)
        return
      }
      try {
        const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json')
        const data = await res.json()
        setRoomDisplayRate(data.twd?.[roomCurrency.toLowerCase()] || 1)
      } catch {
        setRoomDisplayRate(1)
      }
    }
    fetchRoomDisplayRate()
  }, [roomCurrency])

  const fetchRate = async (currency) => {
    if (currency === 'TWD') {
      setForm(f => ({ ...f, exchangeRate: '1' }))
      return
    }
    setRateFetching(true)
    try {
      // fawazahmed0 currency API via jsDelivr CDN — free, no key needed
      const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json')
      const data = await res.json()
      const twdPerUnit = data.twd?.[currency.toLowerCase()]
      // data.twd.jpy = how many JPY per 1 TWD → invert to get TWD per 1 JPY
      if (twdPerUnit) {
        const rate = (1 / twdPerUnit).toFixed(4)
        setLiveRate(rate)
        setForm(f => ({ ...f, exchangeRate: rate }))
        setRateEditing(false)
      }
    } catch {}
    setRateFetching(false)
  }

  const toggleSplit = (id) =>
    setForm(f => ({
      ...f,
      splitAmong: f.splitAmong.includes(id)
        ? f.splitAmong.filter(x => x !== id)
        : [...f.splitAmong, id],
    }))

  const updatePayerRow = (index, patch) =>
    setForm(f => ({
      ...f,
      payerRows: f.payerRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
    }))

  const addPayerRow = () =>
    setForm(f => {
      const usedIds = f.payerRows.map(row => row.userId).filter(Boolean)
      const nextMember = members.find(m => !usedIds.includes(m.id))
      if (!nextMember) return f
      return {
        ...f,
        payerRows: [...f.payerRows, { userId: nextMember.id, amount: '' }],
      }
    })

  const removePayerRow = (index) =>
    setForm(f => ({
      ...f,
      payerRows: f.payerRows.filter((_, rowIndex) => rowIndex !== index),
    }))

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError(t('addExpense.missingTitle')); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError(t('addExpense.invalidAmount')); return }
    if (form.splitAmong.length === 0) { setError(t('addExpense.missingSplit')); return }
    if (form.paymentMode === 'multiple' && Math.abs(payerDiff) >= 0.01) {
      setError(t('addExpense.multiPayerTotalMismatch', { symbol: selectedCurrency.symbol, amount: fmt(Math.abs(payerDiff)) }))
      return
    }
    if (form.paymentMode === 'multiple') {
      const payerIds = form.payerRows.map(row => row.userId).filter(Boolean)
      const positivePayers = form.payerRows.filter(row => row.userId && parseFloat(row.amount || 0) > 0)
      if (new Set(payerIds).size !== payerIds.length) {
        setError(t('addExpense.duplicatePayer'))
        return
      }
      if (positivePayers.length < 2) {
        setError(t('addExpense.multiPayerNeedsTwo'))
        return
      }
    }

    setLoading(true)
    setError(null)

    const expensePayers = form.paymentMode === 'multiple'
      ? form.payerRows
        .map(row => ({ user_id: row.userId, amount_paid: parseFloat(row.amount || 0) }))
        .filter(p => p.user_id)
        .filter(p => p.amount_paid > 0)
      : [{ user_id: form.paidBy, amount_paid: parseFloat(form.amount) }]
    const primaryPayerId = expensePayers[0]?.user_id || form.paidBy

    const payload = {
      paid_by: primaryPayerId,
      amount: parseFloat(form.amount),
      title: form.title.trim(),
      category: form.category,
      currency: form.currency,
      exchange_rate: form.currency === 'TWD' ? 1 : parseFloat(form.exchangeRate) || 1,
      note: form.note.trim() || null,
      expense_date: form.date,
    }

    if (import.meta.env.DEV && !hasAuthToken() && roomId.startsWith('local-demo-')) {
      const expenseId = expense?.id || `local-expense-${Date.now()}`
      const unitAmount = parseFloat(form.amount) / form.splitAmong.length
      const demoExpense = {
        ...payload,
        id: expenseId,
        room_id: roomId,
        created_at: expense?.created_at || new Date().toISOString(),
        expense_splits: form.splitAmong.map(uid => ({
          expense_id: expenseId,
          user_id: uid,
          split_amount: parseFloat(unitAmount.toFixed(2)),
        })),
        expense_payers: expensePayers.map(p => ({ expense_id: expenseId, ...p })),
        users: members.find(m => m.id === form.paidBy),
      }
      const key = `roomiepay_demo_expenses_${roomId}`
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      const next = isEdit
        ? existing.map(item => item.id === expenseId ? demoExpense : item)
        : [demoExpense, ...existing]
      localStorage.setItem(key, JSON.stringify(next))
      track('expense_success', { language, action: isEdit ? 'edit' : 'add', category: form.category, currency: form.currency, payment_mode: form.paymentMode })
      onAdded(form.date)
      return
    }

    let expenseId
    if (isEdit) {
      const { error: upErr } = await supabase.from('expenses').update(payload).eq('id', expense.id)
      if (upErr) { track('expense_error', { action: 'edit' }); setError(t('addExpense.updateFailed')); setLoading(false); return }
      expenseId = expense.id
      const [{ error: splitDeleteErr }, { error: payerDeleteErr }] = await Promise.all([
        supabase.from('expense_splits').delete().eq('expense_id', expenseId),
        supabase.from('expense_payers').delete().eq('expense_id', expenseId),
      ])
      if (splitDeleteErr || payerDeleteErr) {
        track('expense_error', { action: 'edit_cleanup' })
        setError(t('addExpense.updateFailed'))
        setLoading(false)
        return
      }
    } else {
      const { data: newExp, error: expErr } = await supabase
        .from('expenses').insert({ ...payload, room_id: roomId }).select().single()
      if (expErr) { track('expense_error', { action: 'add' }); setError(t('addExpense.addFailed')); setLoading(false); return }
      expenseId = newExp.id
    }

    const unitAmount = parseFloat(form.amount) / form.splitAmong.length
    const splits = form.splitAmong.map(uid => ({
      expense_id: expenseId,
      user_id: uid,
      split_amount: parseFloat(unitAmount.toFixed(2)),
    }))

    const { error: splitErr } = await supabase.from('expense_splits').insert(splits)
    if (splitErr) {
      if (!isEdit) await supabase.from('expenses').delete().eq('id', expenseId)
      track('expense_error', { action: 'split' })
      setError(t('addExpense.splitFailed'))
      setLoading(false)
      return
    }

    const payerRows = expensePayers.map(payer => ({
      expense_id: expenseId,
      user_id: payer.user_id,
      amount_paid: parseFloat(payer.amount_paid.toFixed(2)),
    }))
    const { error: payerErr } = await supabase.from('expense_payers').insert(payerRows)
    if (payerErr) {
      await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
      if (!isEdit) await supabase.from('expenses').delete().eq('id', expenseId)
      track('expense_error', { action: 'payer' })
      setError(t('addExpense.addFailed'))
      setLoading(false)
      return
    }

    // Send summary back to LINE group (no-op outside LINE client or if scope missing)
    const paidByName = members.find(m => m.id === form.paidBy)?.display_name?.split(' ')[0] || ''
    const lines = [
      `💰 ${isEdit ? t('addExpense.shareUpdated') : ''}${form.title.trim()} ${selectedCurrency.symbol}${fmt(parsedAmount)}`,
      t('addExpense.sharePaidSplit', { name: paidByName, count: form.splitAmong.length, symbol: selectedCurrency.symbol, amount: fmt(perPerson) }),
    ]
    if (form.note.trim()) lines.push(t('addExpense.shareNote', { note: form.note.trim() }))
    lines.push('— 哇哩 Wari Pay ✅')
    await sendExpenseMessage(lines.join('\n'))

    track('complete_split', {
      language,
      action: isEdit ? 'edit' : 'add',
      category: form.category,
      currency: form.currency,
    })
    track('expense_success', { language, action: isEdit ? 'edit' : 'add', category: form.category, currency: form.currency })
    onAdded(form.date)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-[32px] w-full max-w-[480px] max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mt-3 mb-1 sticky top-0" />

        <div className="px-4 pb-8 pt-3">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-brand-deep">{isEdit ? t('addExpense.titleEdit') : t('addExpense.titleAdd')}</h2>
            <button onClick={onClose} className="text-brand-mid/60 hover:text-brand-deep w-8 h-8 flex items-center justify-center">
              <LuX className="w-5 h-5" />
            </button>
          </div>

          {/* Amount + currency */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">{t('addExpense.amount', { symbol: selectedCurrency.symbol })}</label>
            <div className="grid grid-cols-[1fr_144px] items-stretch gap-2">
              <div className="flex-1 border border-brand-mint rounded-2xl px-4 py-2 focus-within:border-brand-deep">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  autoFocus={!isEdit}
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') }))}
                  className="w-full text-3xl font-bold text-right text-brand-deep bg-transparent outline-none"
                />
              </div>
              <div className="relative">
                <select
                  value={form.currency}
                  onChange={e => {
                    const nextCurrency = e.target.value
                    setForm(f => ({ ...f, currency: nextCurrency }))
                    if (!isEdit || nextCurrency !== form.currency) fetchRate(nextCurrency)
                  }}
                  className="w-full h-full appearance-none border border-brand-mint rounded-2xl pl-4 pr-10 py-2 bg-white text-brand-deep text-sm font-bold outline-none focus:border-brand-deep"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                  ))}
                </select>
                <LuChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mid" />
              </div>
            </div>
            {form.splitAmong.length > 0 && parsedAmount > 0 && (
              <p className="text-center text-sm text-brand-deep mt-2 font-medium">
                {t('addExpense.each', { symbol: selectedCurrency.symbol, amount: perPerson })}
              </p>
            )}
          </div>

          {/* Exchange rate (non-TWD only) */}
          {form.currency !== 'TWD' && (
            <div className="mb-4">
              <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 flex items-center gap-1.5">
                {t('addExpense.exchangeRate', { currency: form.currency })}
                {rateFetching
                  ? <span className="normal-case font-normal text-brand-mid/50">{t('addExpense.fetching')}</span>
                  : <span className="normal-case font-normal text-brand-mid/40">{t('addExpense.dailyUpdated')}</span>
                }
              </label>
              {rateEditing ? (
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  autoFocus
                  value={form.exchangeRate}
                  onChange={e => setForm(f => ({ ...f, exchangeRate: e.target.value.replace(/[^0-9.]/g, '') }))}
                  onBlur={e => {
                    if (!e.target.value || parseFloat(e.target.value) === 0) setForm(f => ({ ...f, exchangeRate: liveRate }))
                    setRateEditing(false)
                  }}
                  className="w-full border border-brand-deep rounded-2xl px-4 py-3 text-base text-brand-deep focus:outline-none"
                />
              ) : (
                <div className="flex items-center justify-between border border-brand-mint rounded-2xl px-4 py-3">
                  <span className="text-base text-brand-deep">{form.exchangeRate}</span>
                  <button onClick={() => setRateEditing(true)} className="text-brand-mid/50 hover:text-brand-deep transition">
                    <LuPencilLine className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {parsedAmount > 0 && form.currency !== roomCurrency && (
            <div className="mb-4 rounded-2xl bg-brand-cream/80 px-4 py-3 text-sm leading-relaxed text-brand-mid">
              <p>
                {t('addExpense.conversionEstimate')}
                <span className="font-semibold text-brand-deep ml-1">
                  {selectedCurrency.symbol}{fmt(parsedAmount)} ≈ {roomSymbol}{fmtRounded(roomEquiv)}
                </span>
              </p>
              {form.splitAmong.length > 0 && (
                <p className="text-brand-mid/80">
                  {t('addExpense.perPersonApprox')}
                  <span className="font-semibold text-brand-deep ml-1">
                    {selectedCurrency.symbol}{fmt(perPerson)} ≈ {roomSymbol}{fmtRounded(perPersonRoom)}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">
              {t('addExpense.itemName')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder={t('addExpense.itemPlaceholder')}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-base text-brand-deep focus:border-brand-deep outline-none"
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">{t('addExpense.category')}</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setForm(f => ({ ...f, category: cat.key }))}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-2xl border text-sm font-semibold transition-colors ${
                    form.category === cat.key ? 'border-brand-mid/60 bg-brand-mint/70' : 'border-transparent bg-brand-cream'
                  }`}
                >
                  <span className="text-base">{cat.emoji}</span>
                  <span className="text-brand-deep leading-tight text-center">{t(cat.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment and split */}
          <div className="mb-4 rounded-3xl bg-brand-cream/70 px-3 py-3">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">{t('addExpense.paymentAndSplit')}</label>
            <div className="grid grid-cols-2 gap-2 mb-3 rounded-2xl bg-white p-1">
              {[
                { key: 'single', label: t('addExpense.singlePayment') },
                { key: 'multiple', label: t('addExpense.multiplePayment') },
              ].map(option => (
                <button
                  key={option.key}
                  onClick={() => setForm(f => ({ ...f, paymentMode: option.key }))}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    form.paymentMode === option.key ? 'bg-brand-mint/70 text-brand-deep shadow-card' : 'text-brand-mid/70'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {form.paymentMode === 'single' ? (
              <div className="mb-3">
                <p className="text-xs font-medium text-brand-mid mb-2">{t('addExpense.paidBy')}</p>
                <div className="flex gap-2 flex-wrap">
                  {members.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setForm(f => ({ ...f, paidBy: m.id }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-colors ${
                        form.paidBy === m.id ? 'border-brand-mid/50 bg-brand-mint/70 text-brand-deep' : 'border-transparent bg-white text-brand-mid/80'
                      }`}
                    >
                      <Avatar src={m.picture_url} name={m.display_name} userId={m.id} className="w-6 h-6" />
                      <span className="text-sm font-medium">{m.display_name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <p className="text-xs font-medium text-brand-mid mb-2">{t('addExpense.actualPaidByEach')}</p>
                <div className="space-y-1.5">
                  {form.payerRows.map((row, index) => {
                    const selectedIds = form.payerRows
                      .map((payerRow, rowIndex) => rowIndex === index ? null : payerRow.userId)
                      .filter(Boolean)
                    return (
                    <div key={index} className="grid grid-cols-[1fr_120px_auto] items-center gap-2 bg-white rounded-2xl px-3 py-1.5">
                      <div className="relative">
                        <select
                          value={row.userId}
                          onChange={e => updatePayerRow(index, { userId: e.target.value })}
                          className="w-full appearance-none bg-brand-cream/70 rounded-xl pl-3 pr-8 py-2 text-sm font-medium text-brand-deep outline-none"
                        >
                          {members.map(m => (
                            <option key={m.id} value={m.id} disabled={selectedIds.includes(m.id)}>
                              {m.display_name.split(' ')[0]}
                            </option>
                          ))}
                        </select>
                        <LuChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-mid" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-brand-mid">{selectedCurrency.symbol}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.amount}
                        onChange={e => updatePayerRow(index, { amount: e.target.value.replace(/[^0-9.]/g, '') })}
                        placeholder="0"
                        className="w-full bg-brand-cream/70 border border-transparent rounded-xl px-3 py-2 text-right text-base text-brand-deep focus:border-brand-deep outline-none"
                      />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePayerRow(index)}
                        disabled={form.payerRows.length <= 2}
                        className="w-7 h-7 rounded-full text-brand-mid/50 hover:bg-brand-mint/60 hover:text-brand-deep disabled:opacity-20 disabled:hover:bg-transparent"
                        aria-label={t('addExpense.removePayer')}
                      >
                        ×
                      </button>
                    </div>
                    )
                  })}
                </div>
                {canAddPayer && (
                  <button
                    type="button"
                    onClick={addPayerRow}
                    className="mt-2 text-sm font-semibold text-brand-mid hover:text-brand-deep"
                  >
                    {t('addExpense.addPayer')}
                  </button>
                )}
                {parsedAmount > 0 && (
                  <p className={`text-xs mt-2 text-center ${Math.abs(payerDiff) < 0.01 ? 'text-brand-mid/70' : 'text-red-500'}`}>
                    {t('addExpense.payerTotalProgress', { symbol: selectedCurrency.symbol, paid: fmt(payerTotal), total: fmt(parsedAmount) })}
                    {Math.abs(payerDiff) >= 0.01 && t('addExpense.payerDiff', { symbol: selectedCurrency.symbol, amount: fmt(Math.abs(payerDiff)) })}
                  </p>
                )}
                <p className="text-xs text-brand-mid/60 mt-2 leading-relaxed">
                  {t('addExpense.payerHint')}
                </p>
              </div>
            )}

            <div className="h-px bg-brand-mint/70 my-3" />
            <label className="text-xs font-medium text-brand-mid mb-2 block">
              {t('addExpense.splitMembers')}
              <span className="ml-2 normal-case text-brand-mid/60 font-normal">{t('addExpense.splitHint')}</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {members.map(m => {
                const active = form.splitAmong.includes(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleSplit(m.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-colors ${
                      active ? 'border-brand-mid/50 bg-brand-mint/70 text-brand-deep' : 'border-transparent bg-white text-brand-mid/60 line-through'
                    }`}
                  >
                    <Avatar src={m.picture_url} name={m.display_name} userId={m.id} className="w-6 h-6" />
                    <span className="text-sm font-medium">{m.display_name.split(' ')[0]}</span>
                    {active && <LuCheck className="w-3 h-3 text-brand-mid" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">{t('addExpense.date')}</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full h-[50px] border border-brand-mint rounded-2xl px-4 py-3 text-base text-brand-deep focus:border-brand-deep outline-none bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">{t('addExpense.note')}</label>
              <textarea
                placeholder={t('addExpense.notePlaceholder')}
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={2}
                className="w-full min-h-[68px] border border-brand-mint rounded-2xl px-4 py-3 text-base text-brand-deep focus:border-brand-deep outline-none bg-white resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-brand-lime text-brand-deep font-bold py-4 rounded-2xl text-lg hover:brightness-95 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? t('addExpense.saving') : <><LuCheck className="w-5 h-5" /> {isEdit ? t('addExpense.saveEdit') : t('addExpense.submit')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
