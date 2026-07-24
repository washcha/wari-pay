import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify token and get Supabase auth user
  const { data: { user: authUser }, error: authError } = await admin.auth.getUser(token)
  if (authError || !authUser) return res.status(401).json({ error: 'Invalid token' })

  // LINE userId is stored in app_metadata and as the users.id primary key
  const lineUserId = authUser.app_metadata?.line_user_id
  if (!lineUserId) return res.status(400).json({ error: 'Cannot resolve LINE user ID' })

  // 1. Find all expenses paid by this user (to cascade-delete their splits)
  const { data: paidExpenses } = await admin
    .from('expenses')
    .select('id')
    .eq('paid_by', lineUserId)

  const paidExpenseIds = (paidExpenses || []).map(e => e.id)

  // 2. Delete splits of expenses this user paid
  if (paidExpenseIds.length > 0) {
    await admin.from('expense_splits').delete().in('expense_id', paidExpenseIds)
  }

  // 3. Delete this user's share in other people's expenses
  await admin.from('expense_splits').delete().eq('user_id', lineUserId)

  // 4. Delete expenses paid by this user
  await admin.from('expenses').delete().eq('paid_by', lineUserId)

  // 5. Delete settlement payment records
  await admin.from('settlement_payments').delete().eq('payer_id', lineUserId)

  // 6. Disown rooms created by this user (leave them intact for other members)
  await admin.from('rooms').update({ created_by: null }).eq('created_by', lineUserId)

  // 7. Remove from all room_members
  await admin.from('room_members').delete().eq('user_id', lineUserId)

  // 8. Delete from users table
  await admin.from('users').delete().eq('id', lineUserId)

  // 9. Delete Supabase auth user
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(authUser.id)
  if (deleteAuthError) {
    return res.status(500).json({ error: `Auth delete failed: ${deleteAuthError.message}` })
  }

  return res.status(200).json({ ok: true })
}
