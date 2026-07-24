import { createHmac } from 'crypto'

const LINE_API = 'https://api.line.me/v2/bot'
const TRIGGER_KEYWORDS = ['記帳', '/記帳', 'waripay', 'wari', '哇哩']
const COOLDOWN_MS = 30 * 60 * 1000 // 30 分鐘同一個來源只回一次

async function getRawBody(req) {
  if (req.readableEnded || !req.readable) {
    return Buffer.from(JSON.stringify(req.body ?? {}))
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function verifySignature(rawBody, signature, secret) {
  const digest = createHmac('sha256', secret).update(rawBody).digest('base64')
  return digest === signature
}

async function replyMessage(replyToken, messages, channelToken) {
  const res = await fetch(`${LINE_API}/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
  if (!res.ok) {
    console.error('[bot] reply failed:', await res.text())
  }
}

// 冷卻檢查：同一個 groupId 30 分鐘內只回一次，避免超出配額
async function checkAndUpdateCooldown(groupId, supabaseUrl, serviceKey) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  // 查詢上次回覆時間
  const getRes = await fetch(
    `${supabaseUrl}/rest/v1/bot_rate_limits?group_id=eq.${encodeURIComponent(groupId)}&select=last_reply_at`,
    { headers }
  )
  if (getRes.ok) {
    const rows = await getRes.json()
    if (rows.length > 0) {
      const elapsed = Date.now() - new Date(rows[0].last_reply_at).getTime()
      if (elapsed < COOLDOWN_MS) return false // 冷卻中，跳過
    }
  }

  // 更新（或新增）最後回覆時間
  await fetch(`${supabaseUrl}/rest/v1/bot_rate_limits`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ group_id: groupId, last_reply_at: new Date().toISOString() }),
  })

  return true // 可以回覆
}

function buildLiffFlexMessage(liffId) {
  return {
    type: 'flex',
    altText: '點這裡用哇哩 Wari Pay 記帳',
    contents: {
      type: 'bubble',
      styles: {
        body: { backgroundColor: '#F5F7F4' },
        footer: { backgroundColor: '#F5F7F4', separator: false },
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: '🐸 哇哩 Wari Pay', weight: 'bold', size: 'xl', color: '#144516' },
          { type: 'text', text: '免下載，點就記帳！', size: 'sm', color: '#416943', margin: 'sm' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        paddingTop: 'none',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#144516',
            action: { type: 'uri', label: '開始記帳', uri: `https://liff.line.me/${liffId}` },
          },
        ],
      },
    },
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const secret = process.env.LINE_CHANNEL_SECRET
  const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const liffId = process.env.VITE_LIFF_ID
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secret || !channelToken || !liffId) {
    console.error('[bot] Missing env vars: LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN / VITE_LIFF_ID')
    return res.status(500).json({ error: 'Bot not configured' })
  }

  const rawBody = await getRawBody(req)
  const signature = req.headers['x-line-signature']

  if (!signature || !verifySignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let body
  try {
    body = JSON.parse(rawBody.toString())
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const events = body?.events ?? []

  await Promise.all(
    events.map(async (event) => {
      if (event.type !== 'message' || event.message?.type !== 'text') return
      const lower = event.message.text.toLowerCase()
      if (!TRIGGER_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))) return

      // 以群組 / 聊天室 / 用戶 ID 作為冷卻 key
      const groupId = event.source?.groupId ?? event.source?.roomId ?? event.source?.userId ?? 'unknown'

      if (supabaseUrl && serviceKey) {
        const allowed = await checkAndUpdateCooldown(groupId, supabaseUrl, serviceKey)
        if (!allowed) {
          console.log(`[bot] cooldown active for ${groupId}, skipping reply`)
          return
        }
      }

      await replyMessage(event.replyToken, [buildLiffFlexMessage(liffId)], channelToken)
    })
  )

  return res.status(200).json({ ok: true })
}
