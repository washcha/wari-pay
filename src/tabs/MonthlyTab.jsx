import { useState, useEffect } from 'react'
import { LuHouse, LuUser } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import waripayLoading from '../assets/waripay_loading.png'
import waripayNoExpense from '../assets/waripay-noexpense.png'

const CAT_CONFIG = {
  food:          { label: '餐飲',     emoji: '🍜' },
  clothing:      { label: '服飾',     emoji: '👕' },
  housing:       { label: '住宿',     emoji: '🏠' },
  transport:     { label: '交通',     emoji: '🚌' },
  entertainment: { label: '育樂',     emoji: '🎮' },
  other:         { label: '其他',     emoji: '📦' },
  // 舊資料 fallback
  utilities:     { label: '水電瓦斯', emoji: '💡' },
  groceries:     { label: '食品雜貨', emoji: '🛒' },
  supplies:      { label: '生活用品', emoji: '🧴' },
  rent:          { label: '租金',     emoji: '🏠' },
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthlyTab({ roomId, members }) {
  const { user } = useApp()
  const [report, setReport] = useState({ byCategory: [], total: 0, myShare: 0, count: 0 })
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth)
  const [view, setView] = useState('room')

  useEffect(() => { fetchReport() }, [roomId, month])

  const fetchReport = async () => {
    setLoading(true)
    const [year, m] = month.split('-')
    const start = `${year}-${m}-01`
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
    const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`

    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, amount, category, expense_splits(user_id, split_amount)')
      .eq('room_id', roomId)
      .gte('expense_date', start)
      .lte('expense_date', end)

    if (!expenses) { setLoading(false); return }

    const catMap = {}
    let total = 0
    let myShare = 0

    expenses.forEach(e => {
      const amt = parseFloat(e.amount)
      const cat = e.category || 'other'
      catMap[cat] = (catMap[cat] || 0) + amt
      total += amt
      const mine = e.expense_splits?.find(s => s.user_id === user.id)
      if (mine) myShare += parseFloat(mine.split_amount)
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
        return s + (mine ? parseFloat(mine.split_amount) : 0)
      }, 0)

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="bg-white rounded-3xl p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-brand-deep">月度帳務分析</h3>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-sm text-brand-deep border border-brand-mint rounded-xl px-2 py-1"
          />
        </div>

        <div className="flex bg-brand-cream rounded-2xl p-1 mb-4">
          {[
            { key: 'room', label: '全房間', Icon: LuHouse },
            { key: 'me', label: '我的份', Icon: LuUser },
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
            <p className="text-xs text-brand-mid">全房間總計</p>
            <p className="font-bold text-brand-deep text-base mt-0.5">NT$ {report.total.toLocaleString()}</p>
          </div>
          <div className="bg-brand-lime rounded-2xl p-3 text-center">
            <p className="text-xs text-brand-deep/70">我的份額</p>
            <p className="font-bold text-brand-deep text-base mt-0.5">NT$ {report.myShare.toLocaleString()}</p>
          </div>
          <div className="bg-brand-cream border border-brand-mint rounded-2xl p-3 text-center">
            <p className="text-xs text-brand-mid">共 {report.count} 筆</p>
            <p className="font-bold text-brand-deep text-base mt-0.5">
              {members.length > 0 ? `${members.length} 人` : '-'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><img src={waripayLoading} alt="loading" className="w-20 h-20 animate-bounce" /></div>
      ) : report.byCategory.length === 0 ? (
        <div className="text-center py-16">
          <img src={waripayNoExpense} alt="還沒有費用" className="w-28 h-28 mx-auto mb-4" />
          <p className="text-brand-deep">本月還沒有費用記錄</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-5 shadow-card">
          <h4 className="font-semibold text-brand-deep mb-4">費用類別分佈</h4>
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
                      <span className="text-sm text-brand-deep font-medium">{cat.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-brand-deep">
                        NT$ {displayAmt.toLocaleString()}
                      </span>
                      {view === 'me' && displayAmt !== cat.amount && (
                        <span className="text-xs text-brand-mid/60 ml-1">
                          (共 {cat.amount.toLocaleString()})
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
          <h4 className="font-semibold text-brand-deep mb-3">本月支出排行</h4>
          <div className="space-y-2.5">
            {report.byCategory.slice(0, 3).map((cat, i) => (
              <div key={cat.key} className="flex items-center gap-3">
                <span className="text-lg w-7 text-center">{['🥇','🥈','🥉'][i]}</span>
                <span className="text-sm text-brand-deep">{cat.label}</span>
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
