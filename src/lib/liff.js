const LIFF_ID = import.meta.env.VITE_LIFF_ID

let _liff = null

export const initLiff = async () => {
  if (_liff) return _liff
  const liff = (await import('@line/liff')).default
  await liff.init({ liffId: LIFF_ID })
  _liff = liff
  return liff
}

export const getLiffProfile = async (liff) => {
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href })
    return null
  }
  try {
    return await liff.getProfile()
  } catch {
    const token = liff.getDecodedIDToken()
    if (token) {
      return {
        userId: token.sub,
        displayName: token.name || 'LINE User',
        pictureUrl: token.picture || null,
      }
    }
    return null
  }
}

export const getLiffAccessToken = (liff) => liff.getAccessToken?.() || null

export const MOCK_USERS = [
  { userId: 'dev_test_001', displayName: '測試帳號', pictureUrl: null },
  { userId: 'dev_user_001', displayName: '小明（你）', pictureUrl: null },
  { userId: 'dev_user_002', displayName: '小華',       pictureUrl: null },
  { userId: 'dev_user_003', displayName: '小美',       pictureUrl: null },
  { userId: 'dev_user_004', displayName: '阿強',       pictureUrl: null },
  { userId: 'dev_user_mina', displayName: 'Mina',      pictureUrl: null },
]

export const getMockProfile = (index = 0) => MOCK_USERS[index]

export const sendExpenseMessage = async (text) => {
  if (!_liff?.isInClient()) return
  try {
    await _liff.sendMessages([{ type: 'text', text }])
  } catch (e) {
    console.warn('[liff] sendMessages failed:', e?.message)
  }
}

// 開啟 LINE 原生分享頁面（支援 LIFF 內外）
export const openLineShare = (text) => {
  const url = `https://line.me/R/share?text=${encodeURIComponent(text)}`
  if (_liff?.isInClient()) {
    _liff.openWindow({ url, external: true })
  } else {
    window.open(url, '_blank')
  }
}

export const shareInviteCard = async (roomName, inviteUrl, copy = {}) => {
  if (!_liff?.isInClient()) return false
  if (!_liff.isApiAvailable('shareTargetPicker')) return false
  const cardCopy = {
    altText: `Join "${roomName}" on Wari Pay`,
    brand: '🐸 Wari Pay',
    title: `Join "${roomName}"`,
    desc: 'Tap the button to join. No app download needed.',
    button: 'Join Room',
    ...copy,
  }
  try {
    const result = await _liff.shareTargetPicker([
      {
        type: 'flex',
        altText: cardCopy.altText,
        contents: {
          type: 'bubble',
          styles: {
            body: { backgroundColor: '#F5F7F4' },
            footer: { backgroundColor: '#F5F7F4', separator: false },
          },
          hero: {
            type: 'image',
            url: 'https://www.washcc.cc/og-image.png',
            size: 'full',
            aspectRatio: '20:11',
            aspectMode: 'cover',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            paddingAll: 'lg',
            contents: [
              { type: 'text', text: cardCopy.brand, weight: 'bold', size: 'xl', color: '#144516' },
              { type: 'text', text: cardCopy.title, size: 'sm', color: '#416943', margin: 'sm', wrap: true },
              { type: 'text', text: cardCopy.desc, size: 'xs', color: '#416943', wrap: true },
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
                action: { type: 'uri', label: cardCopy.button, uri: inviteUrl },
              },
            ],
          },
        },
      },
    ])
    return !!result
  } catch (e) {
    console.warn('[liff] shareTargetPicker failed:', e?.message)
    return false
  }
}
