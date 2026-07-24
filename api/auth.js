import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// Anon key is public (publishable) — safe to include here
const ANON_KEY = 'sb_publishable_Uq3WmJ9Sunc45tl-arYaEw__Y56twnJ'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const client = createClient(supabaseUrl, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = `line-${userId}@roomiepay.internal`

  // Step 1: Get or create the Supabase user (generateLink doesn't send email)
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError) {
    return res.status(500).json({ error: `generateLink failed: ${linkError.message}` })
  }

  // Step 2: Set a fresh one-time password + confirm email + tag app_metadata.
  // updateUserById invalidates pending magic link tokens — that's fine, we use signInWithPassword next.
  const oneTimePw = randomBytes(32).toString('hex')
  const { error: updateError } = await admin.auth.admin.updateUserById(linkData.user.id, {
    password: oneTimePw,
    email_confirm: true,
    app_metadata: { line_user_id: userId },
  })
  if (updateError) {
    return res.status(500).json({ error: `updateUser failed: ${updateError.message}` })
  }

  // Step 3: Sign in with the one-time password to get a Supabase-issued JWT.
  // app_metadata is baked into the JWT at this point (needed for RLS later).
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password: oneTimePw,
  })
  if (signInError || !signInData?.session) {
    console.error('[auth] signInWithPassword error:', JSON.stringify(signInError))
    return res.status(500).json({ error: signInError?.message || 'Sign-in failed' })
  }

  return res.json({ token: signInData.session.access_token })
}
