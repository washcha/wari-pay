import { useState, useEffect } from 'react'
import { LuHouse, LuUser } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import waripayLoading from '../assets/waripay_loading.png'
import waripayNoExpense from '../assets/waripay-noexpense.png'

const CAT_CONFIG = {
  food:          { labelKey: 'expenses.categoryFood', emoji: '🍜' },
  clothing:      { labelKey: 'expenses.categoryClothing', emoji: '👕' },
  housing:       { labelKey: 'expenses.categoryHousing', emoji: '🏠' },
  transport:     { labelKey: 'expenses.categoryTransport', emoji: '🚌' },
  entertainment: { labelKey: 'expenses.categoryEntertainment', emoji: '🎮' },
  other:         { labelKey: 'expenses.categoryOther', emoji: '📦' },
  // 舊資料 fallback
  utilities:     { labelKey: 'expenses.categoryUtilities', emoji: '💡' },
  groceries:     { labelKey: 'expenses.categoryGroceries', emoji: '🛒' },
  supplies:      { labelKey: 'expenses.categorySupplies', emoji: '🧴' },
  rent:          { labelKey: 'expenses.categoryRent', emoji: '🏠' },
}

const CURRENCY_SYMBOLS = {
  TWD: 'NT$', JPY: '¥', USD: 'US$', KRW: '₩',
}
const sym = (code) => CURRENCY_SYMBOLS[code] || code || 'NT$'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthlyTab({ roomId, members, roomCurrency = 'TWD' }) {
  const { user, t, language } = useApp()
  const [report, setReport] = useState({ byCategory: [], total: 0, myShare: 0, count: 0 })
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth)
  const [view, setView] = useState('room')
  const [displayRate, setDisplayRate] = useState(1)

  useEffect(() => { fetchReport() }, [roomId, month])
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

  const fetchReport = async () => {
    setLoading(true)
    const [year, m] = month.split('-')
    const start = `${year}-${m}-01`
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
    const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`

    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, amount, category, exchange_rate, expense_splits(user_id, split_amount)')
      .eq('room_id', roomId)
      .gte('expense_date', start)
      .lte('expense_date', end)

    if (!expenses) { setLoading(false); return }

    const catMap = {}
    let total = 0
    let myShare = 0

    expenses.forEach(e => {
      const rate = parseFloat(e.exchange_rate || 1)
      const amt = parseFloat(e.amount) * rate
      const cat = e.category || 'other'
      catMap[cat] = (catMap[cat] || 0) + amt
      total += amt
      const mine = e.expense_splits?.find(s => s.user_id === user.id)
      if (mine) myShare += parseFloat(mine.split_amount) * rate
    })

    const byCategory = Object.entries(catMap)
      .map(([key, amount]) => ({ key, amount, ...(CAT_CONFIG[key] ?? { label: key, emoji: '📌' }) }))
      .sort((a, b) => b.amount - a.amount)

    setReport({ byCategory, total, myShare, count: expenses.length, raw: expenses })
    setLoading(false)
  }

  const maxAmt = Math.max(...report.byCategory.map(c => c.amount), 1)

  const getCatMyShare = (catKey) =>
    (report.raw || [])
      .filter(e => (e.category || 'other') === catKey)
      .reduce((s, e) => {
        const mine = e.expense_splits?.find(sp => sp.user_id === user.id)
        return s + (mine ? parseFloat(mine.split_amount) * parseFloat(e.exchange_rate || 1) : 0)
      }, 0)

  const symbol = sym(roomCurrency)
  const displayTotal = report.total * displayRate
  const displayMyShare = report.myShare * displayRate
  const formatAmount = (amount) => Math.round(amount * displayRate).toLocaleString(language)

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="bg-white rounded-3xl p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-brand-deep">{t('monthly.title')}</h3>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-sm text-brand-deep border border-brand-mint rounded-xl px-2 py-1"
          />
        </div>

        <div className="flex bg-brand-cream rounded-2xl p-1 mb-4">
          {[
            { key: 'room', label: t('monthly.roomView'), Icon: LuHouse },
            { key: 'me', label: t('monthly.myView'), Icon: LuUser },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                view === v.key ? 'bg-brand-deep text-white shadow-card' : 'text-brand-mid'
              }`}
            >
              <v.Icon className="w-4 h-4" />
              {v.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-brand-mint rounded-2xl p-3 text-center">
            <p className="text-xs text-brand-mid">{t('monthly.roomTotal')}</p>
            <p className="font-bold text-brand-deep text-base mt-0.5">{symbol} {Math.round(displayTotal).toLocaleString(language)}</p>
          </div>
          <div className="bg-brand-lime rounded-2xl p-3 text-center">
            <p className="text-xs text-brand-deep/70">{t('monthly.myShare')}</p>
            <p className="font-bold text-brand-deep text-base mt-0.5">{symbol} {Math.round(displayMyShare).toLocaleString(language)}</p>
          </div>
          <div className="bg-brand-cream border border-brand-mint rounded-2xl p-3 text-center">
            <p className="text-xs text-brand-mid">{t('monthly.count', { count: report.count })}</p>
            <p className="font-bold text-brand-deep text-base mt-0.5">
              {members.length > 0 ? t('monthly.members', { count: members.length }) : '-'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><img src={waripayLoading} alt="loading" className="w-20 h-20 animate-bounce" /></div>
      ) : report.byCategory.length === 0 ? (
        <div className="text-center py-16">
          <img src={waripayNoExpense} alt={t('monthly.empty')} className="w-28 h-28 mx-auto mb-4" />
          <p className="text-brand-deep">{t('monthly.empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-5 shadow-card">
          <h4 className="font-semibold text-brand-deep mb-4">{t('monthly.distribution')}</h4>
          <div className="space-y-4">
            {report.byCategory.map(cat => {
              const displayAmt = view === 'me' ? getCatMyShare(cat.key) : cat.amount
              const barPct = (cat.amount / maxAmt) * 100
              const roomPct = report.total > 0 ? ((cat.amount / report.total) * 100).toFixed(1) : '0'

              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat.emoji}</span>
                      <span className="text-sm text-brand-deep font-medium">{cat.labelKey ? t(cat.labelKey) : cat.key}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-brand-deep">
                        {symbol} {formatAmount(displayAmt)}
                      </span>
                      {view === 'me' && displayAmt !== cat.amount && (
                        <span className="text-xs text-brand-mid/60 ml-1">
                          ({t('monthly.totalPrefix', { amount: `${symbol} ${formatAmount(cat.amount)}` })})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2.5 bg-brand-cream rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-deep rounded-full transition-all duration-700"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-brand-mid/60 mt-0.5 text-right">{roomPct}%</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && report.byCategory.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-card">
          <h4 className="font-semibold text-brand-deep mb-3">{t('monthly.ranking')}</h4>
          <div className="space-y-2.5">
            {report.byCategory.slice(0, 3).map((cat, i) => (
              <div key={cat.key} className="flex items-center gap-3">
                <span className="text-lg w-7 text-center">{['🥇','🥈','🥉'][i]}</span>
                <span className="text-sm text-brand-deep">{cat.labelKey ? t(cat.labelKey) : cat.key}</span>
                <div className="flex-1 h-1.5 bg-brand-cream rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-lime rounded-full"
                    style={{ width: `${(cat.amount / maxAmt) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-brand-mid">
                  {((cat.amount / report.total) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
