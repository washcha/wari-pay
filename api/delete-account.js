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

  // Keep accounting rows immutable: expenses, splits, payers, and settlements
  // remain as historical ledger records even after the account is deleted.

  // 1. Disown rooms created by this user (leave them intact for other members)
  await admin.from('rooms').update({ created_by: null }).eq('created_by', lineUserId)

  // 2. Mark memberships inactive so the user no longer appears in new expense forms.
  await admin
    .from('room_members')
    .update({ left_at: new Date().toISOString() })
    .eq('user_id', lineUserId)
    .is('left_at', null)

  // 3. Anonymize the profile but keep the users row for foreign-key history.
  await admin
    .from('users')
    .update({
      display_name: '已離開的成員',
      picture_url: null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', lineUserId)

  // 4. Delete Supabase auth user so the account can no longer authenticate.
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(authUser.id)
  if (deleteAuthError) {
    return res.status(500).json({ error: `Auth delete failed: ${deleteAuthError.message}` })
  }

  return res.status(200).json({ ok: true })
}
