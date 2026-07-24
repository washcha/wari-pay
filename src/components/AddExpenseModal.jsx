import { useState } from 'react'
import { track } from '../lib/analytics'
import { LuX, LuCheck, LuPencilLine } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { sendExpenseMessage } from '../lib/liff'

const CATEGORIES = [
  { key: 'food',          label: '餐飲', emoji: '🍜' },
  { key: 'clothing',      label: '服飾', emoji: '👕' },
  { key: 'housing',       label: '住宿', emoji: '🏠' },
  { key: 'transport',     label: '交通', emoji: '🚌' },
  { key: 'entertainment', label: '育樂', emoji: '🎮' },
  { key: 'other',         label: '其他', emoji: '📦' },
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

function Avatar({ src, name }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=144516&color=B0EC70&size=32`
  return (
    <img src={src || fallback} alt={name} className="w-6 h-6 rounded-full object-cover flex-shrink-0"
      onError={e => { e.target.src = fallback }} />
  )
}

export default function AddExpenseModal({ roomId, members, onClose, onAdded, expense = null }) {
  const { user } = useApp()
  const isEdit = !!expense
  const [form, setForm] = useState({
    title: expense?.title || '',
    amount: expense?.amount ? String(expense.amount) : '',
    category: expense?.category || 'other',
    currency: expense?.currency || 'TWD',
    exchangeRate: expense?.exchange_rate ? String(expense.exchange_rate) : '1',
    paidBy: expense?.paid_by || user.id,
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

  const selectedCurrency = CURRENCIES.find(c => c.code === form.currency) || CURRENCIES[0]
  const parsedAmount = parseFloat(form.amount || 0)
  const parsedRate = parseFloat(form.exchangeRate || 1)
  const twdEquiv = parsedAmount * parsedRate
  const perPerson = form.splitAmong.length > 0
    ? (parsedAmount / form.splitAmong.length).toFixed(0)
    : 0
  const perPersonTwd = form.splitAmong.length > 0
    ? (twdEquiv / form.splitAmong.length).toFixed(0)
    : 0

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

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('請填寫項目名稱'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('請填寫有效金額'); return }
    if (form.splitAmong.length === 0) { setError('請至少選擇一位分攤成員'); return }

    setLoading(true)
    setError(null)

    const payload = {
      paid_by: form.paidBy,
      amount: parseFloat(form.amount),
      title: form.title.trim(),
      category: form.category,
      currency: form.currency,
      exchange_rate: form.currency === 'TWD' ? 1 : parseFloat(form.exchangeRate) || 1,
      note: form.note.trim() || null,
      expense_date: form.date,
    }

    let expenseId
    if (isEdit) {
      const { error: upErr } = await supabase.from('expenses').update(payload).eq('id', expense.id)
      if (upErr) { track('expense_error', { action: 'edit' }); setError('更新失敗，請再試一次'); setLoading(false); return }
      expenseId = expense.id
      await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
    } else {
      const { data: newExp, error: expErr } = await supabase
        .from('expenses').insert({ ...payload, room_id: roomId }).select().single()
      if (expErr) { track('expense_error', { action: 'add' }); setError('記帳失敗，請再試一次'); setLoading(false); return }
      expenseId = newExp.id
    }

    const unitAmount = parseFloat(form.amount) / form.splitAmong.length
    const splits = form.splitAmong.map(uid => ({
      expense_id: expenseId,
      user_id: uid,
      split_amount: parseFloat(unitAmount.toFixed(2)),
    }))

    const { error: splitErr } = await supabase.from('expense_splits').insert(splits)
    if (splitErr) { track('expense_error', { action: 'split' }); setError('分攤記錄失敗，請再試一次'); setLoading(false); return }

    // Send summary back to LINE group (no-op outside LINE client or if scope missing)
    const paidByName = members.find(m => m.id === form.paidBy)?.display_name?.split(' ')[0] || ''
    const lines = [
      `💰 ${isEdit ? '（已更新）' : ''}${form.title.trim()} ${selectedCurrency.symbol}${parsedAmount.toLocaleString()}`,
      `付款：${paidByName}　分攤：${form.splitAmong.length} 人（每人 ${selectedCurrency.symbol}${perPerson}）`,
    ]
    if (form.note.trim()) lines.push(`備註：${form.note.trim()}`)
    lines.push('— 哇哩 Wari Pay ✅')
    await sendExpenseMessage(lines.join('\n'))

    track('expense_success', { action: isEdit ? 'edit' : 'add', category: form.category, currency: form.currency })
    onAdded(form.date)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-[32px] w-full max-w-[480px] max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <div className="w-10 h-1 bg-brand-mint rounded-full mx-auto mt-3 mb-1 sticky top-0" />

        <div className="px-4 pb-8 pt-3">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-brand-deep">{isEdit ? '編輯費用' : '新增費用'}</h2>
            <button onClick={onClose} className="text-brand-mid/60 hover:text-brand-deep w-8 h-8 flex items-center justify-center">
              <LuX className="w-5 h-5" />
            </button>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">
              金額 ({selectedCurrency.symbol})
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              autoFocus={!isEdit}
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') }))}
              className="w-full text-4xl font-bold text-center py-2 border-b-2 border-brand-mint focus:border-brand-deep outline-none text-brand-deep bg-transparent"
            />
            {form.splitAmong.length > 0 && parsedAmount > 0 && (
              <p className="text-center text-sm text-brand-deep mt-2 font-medium">
                每人 {selectedCurrency.symbol} {perPerson}
                {form.currency !== 'TWD' && parsedRate > 0 && (
                  <span className="text-brand-mid/60 font-normal ml-1">≈ NT$ {perPersonTwd}</span>
                )}
              </p>
            )}
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">
              項目名稱 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="例：6月台電、早餐食材、衛生紙..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none"
            />
          </div>

          {/* Currency */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">幣別</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => {
                    setForm(f => ({ ...f, currency: c.code }))
                    if (!isEdit || c.code !== form.currency) fetchRate(c.code)
                  }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-colors ${
                    form.currency === c.code
                      ? 'border-brand-deep bg-brand-mint text-brand-deep'
                      : 'border-brand-mint/60 text-brand-mid bg-white'
                  }`}
                >
                  {c.symbol} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exchange rate (non-TWD only) */}
          {form.currency !== 'TWD' && (
            <div className="mb-4">
              <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 flex items-center gap-1.5">
                匯率（1 {form.currency} = ? NT$）
                {rateFetching
                  ? <span className="normal-case font-normal text-brand-mid/50">取得中...</span>
                  : <span className="normal-case font-normal text-brand-mid/40">· 每日更新</span>
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
                  className="w-full border border-brand-deep rounded-2xl px-4 py-3 text-brand-deep focus:outline-none"
                />
              ) : (
                <div className="flex items-center justify-between border border-brand-mint rounded-2xl px-4 py-3">
                  <span className="text-brand-deep">{form.exchangeRate}</span>
                  <button onClick={() => setRateEditing(true)} className="text-brand-mid/50 hover:text-brand-deep transition">
                    <LuPencilLine className="w-4 h-4" />
                  </button>
                </div>
              )}
              {parsedAmount > 0 && parsedRate > 0 && (
                <p className="text-sm text-brand-mid mt-1.5 text-center">
                  {selectedCurrency.symbol} {parsedAmount.toLocaleString()} ≈
                  <span className="text-brand-deep font-semibold ml-1">NT$ {Math.round(twdEquiv).toLocaleString()}</span>
                </p>
              )}
            </div>
          )}

          {/* Category */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">費用類別</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setForm(f => ({ ...f, category: cat.key }))}
                  className={`flex flex-col items-center py-2 px-1 rounded-2xl border-2 transition-colors ${
                    form.category === cat.key ? 'border-brand-deep bg-brand-mint' : 'border-brand-mint/60 bg-brand-cream'
                  }`}
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="text-xs text-brand-deep mt-1 leading-tight text-center">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">日期</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none"
            />
          </div>

          {/* Paid by */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">付款人</label>
            <div className="flex gap-2 flex-wrap">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => setForm(f => ({ ...f, paidBy: m.id }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 transition-colors ${
                    form.paidBy === m.id ? 'border-brand-deep bg-brand-mint text-brand-deep' : 'border-brand-mint/60 text-brand-mid'
                  }`}
                >
                  <Avatar src={m.picture_url} name={m.display_name} />
                  <span className="text-sm font-medium">{m.display_name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Split among */}
          <div className="mb-4">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">
              分攤成員
              <span className="ml-2 normal-case text-brand-mid/60 font-normal">（點擊取消勾選）</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {members.map(m => {
                const active = form.splitAmong.includes(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleSplit(m.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 transition-colors ${
                      active ? 'border-brand-deep bg-brand-mint text-brand-deep' : 'border-brand-mint/60 text-brand-mid/60 line-through'
                    }`}
                  >
                    <Avatar src={m.picture_url} name={m.display_name} />
                    <span className="text-sm">{m.display_name.split(' ')[0]}</span>
                    {active && <LuCheck className="w-3 h-3" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Note */}
          <div className="mb-6">
            <label className="text-xs font-medium text-brand-mid uppercase tracking-wider mb-2 block">備註（選填）</label>
            <input
              type="text"
              placeholder="補充說明..."
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full border border-brand-mint rounded-2xl px-4 py-3 text-brand-deep focus:border-brand-deep outline-none"
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
            {loading ? '儲存中...' : <><LuCheck className="w-5 h-5" /> {isEdit ? '儲存修改' : '確認記帳'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
