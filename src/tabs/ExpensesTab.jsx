import { useState, useEffect } from 'react'
import { LuEllipsisVertical, LuPencil, LuTrash2, LuPlus, LuCheck } from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import AddExpenseModal from '../components/AddExpenseModal'
import waripayLoading from '../assets/waripay_loading.png'
import waripayNoExpense from '../assets/waripay-noexpense.png'

const CAT = {
  food:          { label: '餐飲', emoji: '🍜' },
  clothing:      { label: '服飾', emoji: '👕' },
  housing:       { label: '住宿', emoji: '🏠' },
  transport:     { label: '交通', emoji: '🚌' },
  entertainment: { label: '育樂', emoji: '🎮' },
  other:         { label: '其他', emoji: '📦' },
  // 舊資料 backward compatibility
  utilities:     { label: '水電瓦斯', emoji: '💡' },
  groceries:     { label: '食品雜貨', emoji: '🛒' },
  supplies:      { label: '生活用品', emoji: '🧴' },
  rent:          { label: '租金',     emoji: '🏠' },
}

const CURRENCY_SYMBOLS = {
  TWD: 'NT$', JPY: '¥', USD: 'US$', EUR: '€', HKD: 'HK$',
  KRW: '₩', THB: '฿', SGD: 'S$', AUD: 'A$', GBP: '£',
}
const sym = (code) => CURRENCY_SYMBOLS[code] || code || 'NT$'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ExpensesTab({ roomId, members }) {
  const { user } = useApp()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [activeMenu, setActiveMenu] = useState(null)
  const [month, setMonth] = useState(currentMonth)

  useEffect(() => { fetchExpenses() }, [roomId, month])

  const fetchExpenses = async () => {
    setLoading(true)
    const [year, m] = month.split('-')
    const start = `${year}-${m}-01`
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
    const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`

    const { data } = await supabase
      .from('expenses')
      .select('*, users!paid_by(id, display_name, picture_url), expense_splits(user_id, split_amount)')
      .eq('room_id', roomId)
      .gte('expense_date', start)
      .lte('expense_date', end)
      .order('expense_date', { ascending: false })

    setExpenses(data || [])
    setLoading(false)
  }

  const deleteExpense = async (expenseId) => {
    if (!window.confirm('確定要刪除這筆費用嗎？')) return
    setActiveMenu(null)
    await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
    await supabase.from('expenses').delete().eq('id', expenseId)
    fetchExpenses()
  }

  // All totals in TWD equivalent
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount) * parseFloat(e.exchange_rate || 1), 0)
  const myPaid = expenses
    .filter(e => e.paid_by === user.id)
    .reduce((s, e) => s + parseFloat(e.amount) * parseFloat(e.exchange_rate || 1), 0)

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
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const dow = new Date(y, m - 1, d).getDay()
    return `${m} 月 ${d} 日　週${weekdays[dow]}`
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
            <p className="text-xs text-brand-mid/60">本月房間總計（台幣）</p>
            <p className="font-bold text-brand-deep text-[28px] leading-tight">NT$ {Math.round(total).toLocaleString()}</p>
            <p className="text-xs text-brand-mid/60">我付出 NT$ {Math.round(myPaid).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><img src={waripayLoading} alt="loading" className="w-20 h-20 animate-bounce" /></div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-20">
            <img src={waripayNoExpense} alt="還沒有費用" className="w-28 h-28 mx-auto mb-4" />
            <p className="text-brand-deep">本月還沒有費用紀錄</p>
            <p className="text-brand-mid/70 text-sm mt-1">點右下角 + 開始記帳</p>
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
                  const paidByMe = expense.paid_by === user.id
                  const myShare = expense.expense_splits?.find(s => s.user_id === user.id)
                  const currency = sym(expense.currency)
                  const rate = parseFloat(expense.exchange_rate || 1)
                  const isForeign = expense.currency && expense.currency !== 'TWD'
                  const twdEquiv = parseFloat(expense.amount) * rate

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
                                  {currency} {parseFloat(expense.amount).toLocaleString()}
                                </p>
                                {isForeign && (
                                  <p className="text-xs text-brand-mid/60">≈ NT$ {Math.round(twdEquiv).toLocaleString()}</p>
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
                            <span className="text-xs text-brand-deep bg-brand-mint px-2 py-0.5 rounded-full">{cat.label}</span>
                            <span className={`text-xs flex items-center gap-1 ${paidByMe ? 'text-brand-deep font-medium' : 'text-brand-mid/70'}`}>
                              {paidByMe && <LuCheck className="w-3 h-3" />}
                              {paidByMe ? '你付的' : `${expense.users?.display_name} 付的`}
                            </span>
                          </div>

                          {myShare && (
                            <p className="text-xs text-brand-deep mt-1.5 font-medium">
                              你的份額：{currency} {parseFloat(myShare.split_amount).toLocaleString()}
                              {isForeign && (
                                <span className="text-brand-mid/60 font-normal ml-1">
                                  ≈ NT$ {Math.round(parseFloat(myShare.split_amount) * rate).toLocaleString()}
                                </span>
                              )}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1 mt-2">
                            {expense.expense_splits?.map(split => {
                              const mb = members.find(mb => mb.id === split.user_id)
                              return mb ? (
                                <span key={split.user_id} className="text-xs text-brand-mid bg-brand-cream border border-brand-mint px-2 py-0.5 rounded-full">
                                  {mb.display_name.split(' ')[0]} {currency}{parseFloat(split.split_amount).toLocaleString()}
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
                            onClick={() => { setEditExpense(expense); setActiveMenu(null) }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-brand-deep hover:bg-brand-mint/50"
                          >
                            <LuPencil className="w-4 h-4" /> 編輯
                          </button>
                          <button
                            onClick={() => deleteExpense(expense.id)}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50"
                          >
                            <LuTrash2 className="w-4 h-4" /> 刪除
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
          members={members}
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
