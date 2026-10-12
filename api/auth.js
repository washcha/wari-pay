import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { createRequire } from 'module'
import { OAuth2Client } from 'google-auth-library'

const require = createRequire(import.meta.url)
const disposableDomains = require('disposable-email-domains')

// Anon key is public (publishable) — safe to include here
const ANON_KEY = 'sb_publishable_Uq3WmJ9Sunc45tl-arYaEw__Y56twnJ'
const LINE_PROFILE_API = 'https://api.line.me/v2/profile'
const TEST_ACCOUNTS = {
  'wari-tw-anna': '安娜',
  'wari-tw-yu': '有順',
  'wari-en-emma': 'Emma',
  'wari-en-noah': 'Noah',
  'wari-ja-yui': '結衣',
  'wari-ja-ren': '蓮',
  'wari-ko-mina': 'Mina',
  'wari-ko-jiho': '지호',
}

// Rate limit: counts only FAILED attempts per IP in the window. Successful
// logins never eat into the budget — otherwise a shared NAT (office / cafe /
// mobile carrier) would lock out legitimate users whose roommates share an IP.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_FAILURES = 10

// Disposable email set (built once per cold start).
const DISPOSABLE_SET = new Set(disposableDomains.map(d => d.toLowerCase()))

const googleClient = process.env.GOOGLE_OAUTH_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID)
  : null

async function verifyLineAccessToken(accessToken) {
  if (!accessToken) return null
  const profileRes = await fetch(LINE_PROFILE_API, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) return null
  const profile = await profileRes.json()
  if (!profile?.userId) return null
  return {
    provider: 'line',
    userId: profile.userId, // raw LINE userId, no prefix (back-compat)
    displayName: profile.displayName || 'LINE User',
    pictureUrl: profile.pictureUrl || null,
    email: null,
  }
}

async function verifyGoogleIdToken(idToken) {
  if (!idToken || !googleClient) return null
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    if (!payload?.sub) return null
    if (payload.email && !payload.email_verified) return null
    return {
      provider: 'google',
      userId: `google-${payload.sub}`,
      displayName: payload.name || payload.given_name || 'Google User',
      pictureUrl: payload.picture || null,
      email: payload.email || null,
    }
  } catch {
    return null
  }
}

function isDisposableEmail(email) {
  if (!email) return false
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return DISPOSABLE_SET.has(domain)
}

function clientIp(req) {
  const header = req.headers['x-forwarded-for']
  if (typeof header === 'string') return header.split(',')[0].trim()
  if (Array.isArray(header)) return header[0]
  return req.socket?.remoteAddress || 'unknown'
}

async function checkRateLimit(admin, ip) {
  if (ip === 'unknown') return { ok: true }
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count, error } = await admin
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('succeeded', false)
    .gte('created_at', since)
  if (error) {
    // If the table doesn't exist yet, fail open so LINE login keeps working.
    console.warn('[auth] rate-limit check failed, failing open:', error.message)
    return { ok: true }
  }
  return { ok: (count ?? 0) < RATE_LIMIT_MAX_FAILURES, count: count ?? 0 }
}

async function logAttempt(admin, ip, provider, succeeded) {
  if (ip === 'unknown') return
  await admin
    .from('auth_attempts')
    .insert({ ip, provider, succeeded })
    .then(({ error }) => {
      if (error) console.warn('[auth] log attempt failed:', error.message)
    })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { lineAccessToken, googleIdToken, mockUser, testLogin } = req.body || {}

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ip = clientIp(req)
  const providerHint = googleIdToken ? 'google' : lineAccessToken ? 'line' : testLogin ? 'test' : 'unknown'

  // Rate-limit new sign-in attempts (applies to Google + test; LINE is already
  // protected upstream by LINE's own OAuth throttles, but we count it too so a
  // single IP can't hammer /api/auth across providers).
  const rate = await checkRateLimit(admin, ip)
  if (!rate.ok) {
    return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' })
  }

  let profile = await verifyLineAccessToken(lineAccessToken)
  if (!profile) profile = await verifyGoogleIdToken(googleIdToken)

  if (!profile && testLogin?.username && testLogin?.password) {
    const configuredUsername = process.env.TEST_LOGIN_USERNAME
    const configuredUsernames = (process.env.TEST_LOGIN_USERNAMES || '')
      .split(',')
      .map(username => username.trim())
      .filter(Boolean)
    const configuredPassword = process.env.TEST_LOGIN_PASSWORD
    const username = String(testLogin.username).trim()
    const isAllowedLegacyUser = configuredUsername && username === configuredUsername
    const isAllowedListedUser = configuredUsernames.includes(username) && TEST_ACCOUNTS[username]
    if (
      configuredPassword &&
      (isAllowedLegacyUser || isAllowedListedUser) &&
      testLogin.password === configuredPassword
    ) {
      profile = {
        provider: 'test',
        userId: `test-${username}`,
        displayName: TEST_ACCOUNTS[username] || 'Wari Test',
        pictureUrl: null,
        email: null,
      }
    }
  }

  if (!profile && process.env.ALLOW_MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production' && mockUser?.userId) {
    profile = {
      provider: 'mock',
      userId: mockUser.userId,
      displayName: mockUser.displayName || 'Mock User',
      pictureUrl: mockUser.pictureUrl || null,
      email: null,
    }
  }

  if (!profile) {
    await logAttempt(admin, ip, providerHint, false)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  // Phase A: block disposable Google emails to deter farming. We do not store
  // the email in our users table — it is only used here for the check and to
  // key the Supabase auth row.
  if (profile.provider === 'google' && isDisposableEmail(profile.email)) {
    await logAttempt(admin, ip, 'google', false)
    return res.status(403).json({ error: 'Disposable email addresses are not allowed.' })
  }

  const client = createClient(supabaseUrl, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Email keying for the Supabase auth row:
  //   LINE  → line-<userId>@roomiepay.internal  (unchanged, back-compat)
  //   Google → real verified Google email       (lets us wire notifications later without re-auth)
  //   test/mock → test-<userId>@roomiepay.internal
  const authEmail = profile.provider === 'google' && profile.email
    ? profile.email
    : profile.provider === 'line'
      ? `line-${profile.userId}@roomiepay.internal`
      : `${profile.provider}-${profile.userId}@roomiepay.internal`

  // Step 1: Get or create the Supabase user (generateLink doesn't send email)
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: authEmail,
  })
  if (linkError) {
    await logAttempt(admin, ip, profile.provider, false)
    return res.status(500).json({ error: `generateLink failed: ${linkError.message}` })
  }

  // Step 2: Set a fresh one-time password + confirm email + tag app_metadata.
  // We keep the field name `line_user_id` so existing RLS policies keep working
  // for Google users too (field is semantically "app user id" now).
  const oneTimePw = randomBytes(32).toString('hex')
  const { error: updateError } = await admin.auth.admin.updateUserById(linkData.user.id, {
    password: oneTimePw,
    email_confirm: true,
    app_metadata: {
      line_user_id: profile.userId,
      auth_provider: profile.provider,
    },
  })
  if (updateError) {
    await logAttempt(admin, ip, profile.provider, false)
    return res.status(500).json({ error: `updateUser failed: ${updateError.message}` })
  }

  // Step 3: Sign in with the one-time password to get a Supabase-issued JWT.
  // app_metadata is baked into the JWT at this point (needed for RLS).
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: authEmail,
    password: oneTimePw,
  })
  if (signInError || !signInData?.session) {
    console.error('[auth] signInWithPassword error:', JSON.stringify(signInError))
    await logAttempt(admin, ip, profile.provider, false)
    return res.status(500).json({ error: signInError?.message || 'Sign-in failed' })
  }

  await logAttempt(admin, ip, profile.provider, true)

  // Return only non-sensitive profile fields (no email) so the client never
  // caches the Google email in localStorage.
  return res.json({
    token: signInData.session.access_token,
    profile: {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    },
  })
}
