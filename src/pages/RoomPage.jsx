import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import {
  LuChevronLeft,
  LuEllipsisVertical,
  LuUserPlus,
  LuLogOut,
  LuTrash2,
  LuReceipt,
  LuArrowRightLeft,
  LuChartColumn,
  LuPencil,
} from 'react-icons/lu'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import ExpensesTab from '../tabs/ExpensesTab'
import SettlementTab from '../tabs/SettlementTab'
import MonthlyTab from '../tabs/MonthlyTab'
import InviteSheet from '../components/InviteSheet'
import Avatar from '../components/Avatar'

const TABS = [
  { key: 'expenses', labelKey: 'room.tabsExpenses', Icon: LuReceipt },
  { key: 'settlement', labelKey: 'room.tabsSettlement', Icon: LuArrowRightLeft },
  { key: 'monthly', labelKey: 'room.tabsMonthly', Icon: LuChartColumn },
]

export default function RoomPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, t } = useApp()
  const [tab, setTab] = useState('expenses')
  const [room, setRoom] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [showRoomMenu, setShowRoomMenu] = useState(false)
  const [tipDismissed, setTipDismissed] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { fetchRoomData() }, [roomId])

  const fetchRoomData = async () => {
    if (import.meta.env.DEV && roomId.startsWith('local-demo-')) {
      const savedRoom = localStorage.getItem(`roomiepay_demo_room_${roomId}`)
      const demoRoom = savedRoom ? JSON.parse(savedRoom) : {
        id: roomId,
        name: 'Local demo room',
        created_by: user.id,
        base_currency: 'TWD',
        created_at: new Date().toISOString(),
      }
      setMembers([
        user,
        { id: 'local-demo-friend', display_name: '有順', picture_url: null },
        { id: 'local-demo-friend-2', display_name: '小安', picture_url: null },
        { id: 'local-demo-friend-3', display_name: 'Mina', picture_url: null },
        { id: 'local-demo-friend-4', display_name: 'Ren', picture_url: null },
        { id: 'local-demo-friend-5', display_name: 'Emma', picture_url: null },
        { id: 'local-demo-friend-6', display_name: 'Jiho', picture_url: null },
      ])
      setRoom(demoRoom)
      setLoading(false)
      return
    }

    const { data: existingMembership } = await supabase
      .from('room_members')
      .select('id, left_at')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    const { error: joinError } = existingMembership?.left_at
      ? await supabase.from('room_members').update({ left_at: null }).eq('id', existingMembership.id)
      : !existingMembership
        ? await supabase.from('room_members').insert({ room_id: roomId, user_id: user.id })
        : { error: null }

    if (joinError && joinError.code !== '23505') {
      navigate('/')
      return
    }

    const [{ data: roomData, error }, { data: membersData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).single(),
      supabase.from('room_members').select('user_id, left_at, users(id, display_name, picture_url)').eq('room_id', roomId),
    ])

    if (error || !roomData) { navigate('/'); return }

    setMembers(membersData?.map(m => m.users ? { ...m.users, left_at: m.left_at } : null).filter(Boolean) || [])
    setRoom({
      ...roomData,
      base_currency: roomData.base_currency || 'TWD',
    })
    setLoading(false)
  }

  const startEditName = () => {
    setNameInput(room.name)
    setEditingName(true)
    setTimeout(() => nameRef.current?.focus(), 50)
  }

  const saveRoomName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === room.name) { setEditingName(false); return }
    await supabase.from('rooms').update({ name: trimmed }).eq('id', roomId)
    setRoom(r => ({ ...r, name: trimmed }))
    setEditingName(false)
  }

  const leaveRoom = async () => {
    if (!window.confirm(t('room.leaveConfirm'))) return
    setShowRoomMenu(false)
    await supabase.from('room_members').update({ left_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id)
    navigate('/')
  }

  const deleteRoom = async () => {
    if (!window.confirm(t('room.deleteConfirm', { name: room.name }))) return
    setShowRoomMenu(false)
    await supabase.from('rooms').delete().eq('id', roomId)
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-cream">
        <div className="text-5xl animate-bounce">🏠</div>
      </div>
    )
  }

  const isAdmin = room.created_by === user.id
  const activeMembers = members.filter(member => !member.left_at)

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col">
      <div className="bg-brand-deep text-white px-4 pt-10 pb-0 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => navigate('/')} className="text-white pr-1 hover:bg-white/15 rounded-full w-9 h-9 flex items-center justify-center">
            <LuChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                ref={nameRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={saveRoomName}
                onKeyDown={e => { if (e.key === 'Enter') saveRoomName(); if (e.key === 'Escape') setEditingName(false) }}
                className="bg-white/15 text-white font-bold text-lg rounded-lg px-2 py-0.5 outline-none w-full placeholder-brand-mint/60"
                placeholder={t('room.namePlaceholder')}
              />
            ) : (
              <button onClick={startEditName} className="text-left w-full flex items-center gap-1.5">
                <h1 className="font-bold text-lg truncate min-w-0">{room.name}</h1>
                <LuPencil className="w-3.5 h-3.5 text-brand-mint/70 flex-shrink-0" />
              </button>
            )}
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setTipDismissed(true); setShowInvite(true) }}
              className="bg-brand-mint text-brand-deep text-sm font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5"
            >
              <LuUserPlus className="w-4 h-4" />
              {t('room.invite')}
            </button>
            {!tipDismissed && activeMembers.length === 1 && (
              <div className="absolute right-0 top-full mt-2 z-40">
                <div className="absolute right-4 -top-1.5 w-3 h-3 bg-brand-lime rotate-45 rounded-sm" />
                <div className="bg-brand-lime text-brand-deep text-xs font-semibold px-3 py-2 rounded-2xl shadow-soft whitespace-nowrap">
                  {t('room.inviteTip')}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowRoomMenu(m => !m)}
              className="w-8 h-8 flex items-center justify-center text-white rounded-full hover:bg-white/15"
            >
              <LuEllipsisVertical className="w-5 h-5" />
            </button>
            {showRoomMenu && (
              <div className="absolute right-0 top-9 bg-white rounded-2xl shadow-soft border border-brand-mint/40 z-30 overflow-hidden min-w-[140px]">
                <button
                  onClick={leaveRoom}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-brand-deep hover:bg-brand-mint/50"
                >
                  <LuLogOut className="w-4 h-4" /> {t('room.leaveRoom')}
                </button>
                {isAdmin && (
                  <button
                    onClick={deleteRoom}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50"
                  >
                    <LuTrash2 className="w-4 h-4" /> {t('room.deleteRoom')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center mb-3 gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
            {activeMembers.slice(0, 7).map(m => (
              <div key={m.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                <Avatar src={m.picture_url} name={m.display_name} userId={m.id} className="w-9 h-9" imageClassName="border-2 border-white" />
                <span className="text-xs text-brand-mint/80 w-10 truncate text-center block">
                  {m.display_name.split(' ')[0]}
                </span>
              </div>
            ))}
            {activeMembers.length > 7 && (
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-brand-mid/50 flex items-center justify-center text-xs text-white font-bold border-2 border-white">
                  +{activeMembers.length - 7}
                </div>
                <span className="text-xs text-brand-mint/80 w-10 text-center block">{t('room.more')}</span>
              </div>
            )}
          </div>
          <span className="text-xs text-brand-mint/70 flex-shrink-0">{t('room.members', { count: activeMembers.length })}</span>
        </div>

        <div className="flex">
          {TABS.map(tabItem => (
            <button
              key={tabItem.key}
              onClick={() => { setTab(tabItem.key); track('tab_change', { tab: tabItem.key }) }}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                tab === tabItem.key
                  ? 'text-brand-lime border-b-2 border-brand-lime'
                  : 'text-brand-mint/60'
              }`}
            >
              <tabItem.Icon className="w-4 h-4" />
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'expenses' && <ExpensesTab roomId={roomId} members={members} activeMembers={activeMembers} roomCurrency={room.base_currency} />}
        {tab === 'settlement' && <SettlementTab roomId={roomId} members={members} roomCurrency={room.base_currency} />}
        {tab === 'monthly' && <MonthlyTab roomId={roomId} members={members} roomCurrency={room.base_currency} />}
      </div>

      {showRoomMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowRoomMenu(false)} />
      )}

      {showInvite && (
        <InviteSheet roomId={roomId} roomName={room.name} onClose={() => setShowInvite(false)} />
      )}
    </div>
  )
}
