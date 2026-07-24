# 哇哩 Wari Pay — 開發紀錄

> 最後更新：2026-07-22（UX 優化：表單欄位順序、匯率唯讀、空值插圖、confirm modal）

---

## 產品定位

「免下載 App，在 LINE 點開即用」的分帳工具。
不限室友——出遊、聚餐、辦活動都能用。
目標用戶：需要共同分攤費用的任何群體。

**品牌**：哇哩（わり = 日文「分攤」諧音蛙叫）· Wari Pay
**Logo**：青蛙咬錢幣，手繪風格，`src/assets/waripay.png`
**Loading 圖**：青蛙咬錢幣（黑白線條版），`src/assets/waripay_loading.png`

---

## 技術架構

| 層 | 技術 |
|----|------|
| 前端 | React 18 + Vite 5 + Tailwind CSS 3 |
| 後端 / DB | Supabase（PostgreSQL + REST API） |
| 認證 | LINE LIFF v2（`@line/liff ^2.22.3`） |
| 部署 | Vercel |

**本機路徑：** `/Users/cc.hsien/work/roomiepay/`

**Production URL：** `https://www.washcc.cc`（正式域名，2026-06-23 起）
（`washcc.cc` 308 redirect → `www.washcc.cc`）
（舊 `waripay-peach.vercel.app` 仍有效，`roomiepay-peach.vercel.app` 307 redirect）

---

## 設計系統

### 色票（tailwind.config.js）

| Token | Hex | 用途 |
|-------|-----|------|
| `brand-deep` | `#144516` | 主色、Header、主要文字 |
| `brand-mid` | `#416943` | 次要文字、border |
| `brand-lime` | `#B0EC70` | 主要 CTA 按鈕背景 |
| `brand-mint` | `#D7E2D6` | 次要按鈕、標籤、選中背景 |
| `brand-cream` | `#F5F7F4` | 頁面底色 |

**按鈕規則：**
- Main CTA：`bg-brand-lime text-brand-deep`
- Secondary：`bg-brand-mint text-brand-deep`

**陰影：**
- `shadow-soft`：`0 4px 16px -4px rgba(20,69,22,0.12)`
- `shadow-card`：`0 2px 10px -2px rgba(20,69,22,0.08)`

### Icon 系統
使用 `react-icons/lu`（Lucide）取代功能性 emoji，保留類別 / 裝飾性 emoji（💡🛒🧴 等）。

---

## 資料庫結構（Supabase）

```
users               — LINE 用戶（id = LINE userId, display_name, picture_url）
rooms               — 房間（id, name, created_by）
room_members        — 房間成員，多對多（room_id, user_id）
expenses            — 費用主表（room_id, paid_by, amount, title, category, note, expense_date, exchange_rate, currency, created_at）
expense_splits      — 分攤明細（expense_id, user_id, split_amount）
settlement_payments — 結清記錄（room_id, month, payer_id, amount, note, created_at）
                      UNIQUE(room_id, month, payer_id)
                      created_at 作為結清時間截點，用於偵測結清後新增的帳目
```

**重要 FK 限制：** 刪除 expense 前必須先刪 expense_splits。

**費用類別（前端 enum，對應 DB category 欄位）：**

| Key | 標籤 | Emoji |
|-----|------|-------|
| `food` | 餐飲 | 🍜 |
| `clothing` | 服飾 | 👕 |
| `housing` | 住宿 | 🏠 |
| `transport` | 交通 | 🚌 |
| `entertainment` | 育樂 | 🎮 |
| `other` | 其他 | 📦 |

舊類別（backward compatibility fallback）：`utilities`、`groceries`、`supplies`、`rent`

**RLS：** MVP 階段全開（`FOR ALL USING (true)`），正式推廣前需收緊。

詳細 Schema 見 `supabase_schema.sql`。

---

## 功能完成狀態

### ✅ 已完成（含部署）

| 功能 | 說明 |
|------|------|
| 開發 mock 登入 | 4 個測試帳號可切換，`DEV && !LIFF_ID` 時啟用 |
| LINE LIFF 登入 | 生產環境走 `liff.login()`，singleton init 在 React 掛載前執行 |
| 認證機制 | `api/auth.js`：generateLink → updateUserById(password) → signInWithPassword，解決 verifyOtp 失敗 |
| 建立房間 | UUID 房間 ID，`created_by` 記錄建立者 |
| 加入房間 | 邀請連結（`?join=roomId`）或輸入房間 ID 均可 |
| 修改房間名稱 | Header 點 ✏️ inline 編輯，onBlur / Enter 儲存 |
| 邀請成員 | Web Share API 分享 LIFF 連結，不支援時 copy to clipboard |
| 頭像列表 | 最多顯示 7 位，超出顯示 `+N` badge，成員數顯示在頭像列右側 |
| 新增費用 | 欄位順序：金額（autoFocus 彈數字鍵盤）→ 項目名稱（必填 `*`）→ 幣別 → 匯率 → 類別 → 日期 → 付款人 → 分攤成員 |
| 編輯費用 | ⋮ 選單 → 帶入原始資料，UPDATE + 重建 splits |
| 刪除費用 | ⋮ 選單 → confirm → 先刪 splits 再刪 expense |
| 費用列表 | 依月份篩選，同一月份內依日期分組顯示 section header，顯示類別、付款人、分攤明細、備註 |
| 結算 Tab | 本人卡片置頂，正負差額，支援過去月份結清 |
| 結清款項 | 欠款方記錄結清（備註 + 金額），收款方可見狀態與備註 |
| 結清後新帳偵測 | 以 `expense.created_at`（系統建立時間）vs `payment.created_at`（結清時間）作差額比對；結清後新增帳目顯示第二張獨立紅底卡片 |
| 兩張獨立結算卡片 | hasNewDebt 時以 React Fragment 渲染：卡片一=已結清（±0），卡片二=新增差額（需補繳）|
| 尚未結清提示 | 收款方看到欠款成員的「尚未結清」狀態 + 複製提醒訊息按鈕 |
| 結清後分享 LINE | 結清成功後出現「分享到 LINE 群」按鈕，以 URL scheme `line.me/R/share?text=...` 開啟，不需 `chat_message.write` permission |
| 月報 Tab | 類別長條圖，全房間 / 我的份額切換 |
| OG meta tags | 分享時顯示「哇哩 Wari Pay」+ 青蛙圖 |
| GA4 Analytics | `react-ga4`，Measurement ID `G-9KDQJ2XFPW`，`initGA()` 在 `App.jsx` 頂層呼叫，自訂事件透過 `src/lib/analytics.js` wrapper 的 `track()` 發送 |
| 隱私權政策頁 | `/privacy` public route（不需登入），`src/pages/PrivacyPolicy.jsx`，登入頁底部有連結，聯絡信箱 `s840835@gmail.com` |
| 刪除帳號 | Home 頁 Header ⚙️ 選單 → 自製 Confirm Modal（取代 `window.confirm`）→ `DELETE /api/delete-account`（需 JWT）→ 依序清除 expense_splits、expenses、settlement_payments、disown rooms、room_members、users、auth user |
| 登出 | 登出也走 Confirm Modal，整合進 ⚙️ 設定選單（不再是獨立按鈕） |
| Loading 動畫 | 全域 Spinner 改用青蛙圖（`waripay_loading.png`）取代 🏠，`w-20 h-20 animate-bounce`；涵蓋 Home、ExpensesTab、SettlementTab、MonthlyTab |
| 空值插圖 | Home 無房間用 `waripay-emptyroom.png`；費用列表 / 月報無費用用 `waripay-noexpense.png`（青蛙咬錢幣）取代 emoji |
| 邀請 tooltip | 房間只有 1 位成員時，邀請按鈕下方顯示「要分帳記得先邀請朋友加入！」，點邀請後消失 |
| 匯率唯讀 | 切換非 TWD 幣別後，匯率欄位預設唯讀（純文字 + `LuPencilLine` icon）；點鉛筆 icon 才解鎖編輯；換幣重新抓取後自動回鎖；防止用戶手滑改錯 |
| 匯率每日更新 hint | 匯率 label 右側顯示 `· 每日更新`（灰色淡字），抓取中時改顯示「取得中...」 |
| 自訂域名 | `washcc.cc` 購於 Cloudflare（$8/年），DNS Auto configure via Vercel，`www.washcc.cc` 為 Production |
| LIFF Endpoint 更新 | LINE Developers Console Endpoint URL 改為 `https://www.washcc.cc` |
| Vercel 部署 | Production: `https://www.washcc.cc`（原 `waripay-peach.vercel.app` 仍有效） |
| 舊網址轉址 | `index.html` 早期 redirect script，`waripay-peach.vercel.app` / `roomiepay-peach.vercel.app` → `www.washcc.cc` |
| LINE Bot 整合 | 群組輸入觸發關鍵字 → Bot 回覆 LIFF Flex Message 按鈕，`api/bot.js`，HMAC-SHA256 簽章驗證 |
| 記帳後推播 | 記帳完成後 `liff.sendMessages()` 回傳摘要訊息到群組（需 `chat_message.write` scope） |
| Supabase RLS 收緊 | 全開政策替換為基於 JWT `app_metadata.line_user_id` 的房間成員驗證，`supabase_rls.sql` |

### 🔐 對外推廣前必做：資安強化

> ✅ RLS 已於 2026-06-23 完成收緊。

1. ~~**Supabase RLS 收緊**~~ ✅ 完成（2026-06-23）

2. **資料搬到東京（ap-northeast-1）**
   - 目前在新加坡，推廣後考慮搬到東京更接近台灣法規環境

3. **隱私權政策 + 刪除帳號功能** ✅ 全部完成（2026-06-27/30）
   - 隱私政策頁：`https://www.washcc.cc/privacy`
   - 刪除帳號：Home 頁 ⚙️ 選單 → 確認 → 呼叫 `/api/delete-account`

4. **備註欄加密**（選做）
   - 防止用戶貼銀行轉帳資訊被明文存入 DB

### 🟢 未來功能（Post-MVP）

7. 自訂分攤比例（目前只支援均分）
8. 結清款項支援圖片上傳（需 Supabase Storage）
9. 收款方「確認收款」功能（需 settlement_payments 加 confirmed_by 欄位）

---

## 刪除帳號 API（`api/delete-account.js`）

`DELETE /api/delete-account`，需要 `Authorization: Bearer <JWT>`。

刪除順序（FK 安全）：
1. `expense_splits` where `expense_id IN (expenses paid by user)` — 先清 paid 費用的 splits
2. `expense_splits` where `user_id = lineUserId` — 清此人在他人費用的 splits
3. `expenses` where `paid_by = lineUserId`
4. `settlement_payments` where `payer_id = lineUserId`
5. `rooms` SET `created_by = NULL` where `created_by = lineUserId`（保留房間給其他成員）
6. `room_members` where `user_id = lineUserId`
7. `users` where `id = lineUserId`
8. `auth.admin.deleteUser(authUser.id)`

LINE userId 從 JWT 的 `app_metadata.line_user_id` 取得。

---

## GA4 Analytics 自訂事件

Measurement ID：`G-9KDQJ2XFPW`
實作：`src/lib/analytics.js`（`react-ga4` wrapper）

| 事件名稱 | 觸發時機 | 附帶參數 |
|---------|---------|---------|
| `login_attempt` | 點擊「以 LINE 帳號登入」 | — |
| `login_success` | 登入成功 | — |
| `login_error` | 登入失敗 | `message` |
| `create_room_success` | 建立房間成功 | — |
| `create_room_error` | 建立房間失敗 | — |
| `join_room_success` | 加入房間成功 | — |
| `join_room_error` | 加入失敗 | `reason`（not_found / room_full / unknown）|
| `tab_change` | 切換 Tab | `tab`（expenses / settlement / monthly）|
| `expense_success` | 記帳成功 | `action`（add / edit）、`category`、`currency` |
| `expense_error` | 記帳失敗 | `action`（add / edit / split）|

GA4 加強型評估另外自動追蹤：`page_view`、`scroll`、`click`（外連）等。

---

## LINE Bot 整合重點備忘

### 建立 Messaging API Channel（2026 年後新流程）

LINE Developers Console 已**不再支援直接建立 Messaging API Channel**。正確流程：

1. 前往 [LINE Official Account Manager](https://manager.line.biz)
2. 建立官方帳號（或使用既有帳號）
3. 左側選單 → **擴充功能** → **Messaging API** → 「啟用 Messaging API」
4. 選擇 Provider → 確認後即自動建立 Messaging API Channel
5. 回到 LINE Developers Console 取得 **Channel Secret** 與 **Channel Access Token**

### Webhook 設定

Webhook URL：`https://www.washcc.cc/api/bot`

LINE Official Account Manager → **回應設定** 必須如下：

| 設定 | 值 |
|------|-----|
| 聊天 | 停用 |
| Webhook | **啟用** |
| 自動回應訊息 | 停用 |

### 加入群組設定

LINE Developers Console → Channel → Messaging API → **功能切換**：
- 「加入群組或多人聊天室」→ 選「**接受邀請加入群組或多人聊天室**」

（預設是「不接受邀請」，不改的話 Bot 邀請後會立即退出）

### Vercel 環境變數

```
LINE_CHANNEL_SECRET=（LINE OA Manager → Messaging API 頁面取得）
LINE_CHANNEL_ACCESS_TOKEN=（LINE Developers Console → Issue token）
VITE_LIFF_ID=（已設定）
```

### 觸發關鍵字

`記帳` / `/記帳` / `waripay` / `wari` / `哇哩`（大小寫不分）

### `liff.sendMessages()` 記帳後推播

- 需要 LIFF app 加入 `chat_message.write` scope
- 只在 LINE client 內執行（`_liff.isInClient()` 為 true）
- 非 LINE 環境下靜默略過（no-op）

---

## LIFF 整合重點備忘

```
邀請連結格式（正式）：https://liff.line.me/{LIFF_ID}?join={roomId}
邀請連結格式（開發）：http://localhost:5174?join={roomId}
```

**初始化順序很重要：**
`main.jsx` 在 React `createRoot()` 之前先跑 `liff.init()`，
否則 React Router 會在 LIFF 處理 token 前搶走 URL，導致「unable to load client feature」錯誤。

**Singleton 模式（`src/lib/liff.js`）：**
`let _liff = null`，`initLiff()` 回傳同一個實例，避免重複初始化。

**`openLineShare(text)`：**
以 `https://line.me/R/share?text=ENCODED` URL scheme 開啟 LINE 分享頁。
在 LIFF client 內用 `_liff.openWindow({ external: true })`，否則用 `window.open('_blank')`。
不需要 `chat_message.write` scope，通用於所有環境。

```js
export const openLineShare = (text) => {
  const url = `https://line.me/R/share?text=${encodeURIComponent(text)}`
  if (_liff?.isInClient()) {
    _liff.openWindow({ url, external: true })
  } else {
    window.open(url, '_blank')
  }
}
```

---

## 前端架構

```
src/
├── main.jsx              — LIFF init → React mount
├── App.jsx               — Router（/, /room/:roomId, /privacy）+ GA4 init
├── assets/
│   ├── waripay.png           — 青蛙 logo（登入頁 + OG image）
│   └── waripay_loading.png   — 青蛙 loading 圖（黑白線條，96px bounce）
├── contexts/
│   └── AppContext.jsx    — user state, signIn()
├── pages/
│   ├── Login.jsx         — LIFF 登入 / mock 登入選擇器
│   ├── Home.jsx          — 房間列表、建立/加入房間、⚙️ 設定選單（隱私政策、刪除帳號）
│   ├── RoomPage.jsx      — 房間頁（Header + 3 個 Tab）
│   └── PrivacyPolicy.jsx — 隱私政策頁（public，不需登入）
├── tabs/
│   ├── ExpensesTab.jsx   — 帳單列表 + 新增/編輯/刪除
│   ├── SettlementTab.jsx — 結算差額 + 結清記錄
│   └── MonthlyTab.jsx    — 月報類別圖
├── components/
│   ├── AddExpenseModal.jsx     — 新增 & 編輯費用（expense prop 控制模式）
│   ├── CreateRoomModal.jsx
│   ├── JoinRoomModal.jsx
│   ├── InviteSheet.jsx         — 分享邀請連結 bottom sheet
│   └── SettlePaymentModal.jsx  — 結清款項記錄
└── lib/
    ├── supabase.js        — Supabase client
    ├── liff.js            — LIFF singleton + mock users
    └── analytics.js       — GA4 wrapper（initGA, track）
```

**Tailwind JIT 注意：** 動態 class（如 `` `w-${size}` ``）不會被 JIT 產生，必須用完整字串（`w-9 h-9`）。

---

## 已知 Bug 紀錄（均已修復）

| Bug | 原因 | 修法 |
|-----|------|------|
| 頭像列表爆版 | Tailwind JIT 不產生動態 class | 改用 `w-9 h-9` 硬寫 |
| `channel not found` | DEV 環境跑 LIFF init | `NO_LIFF` flag 跳過 init |
| `unable to load client feature` | React Router 搶在 LIFF 前接管 URL | main.jsx 先 liff.init() 再 mount |
| 刪除費用 FK 錯誤 | expense_splits 有 FK 指向 expenses | 先 delete splits 再刪 expense |
| 三點選單點外側無法關閉 | 缺少 backdrop | 加 `fixed inset-0 z-20` 透明 div |
| `LuMoreVertical` 不存在 | react-icons/lu 改名 | 換成 `LuEllipsisVertical` |
| Supabase verifyOtp 失敗 | magiclink token 無法驗證 | 改用 updateUserById(password) + signInWithPassword |
| LINE Bot 無法加群組 | 預設「不接受邀請加入群組」 | LINE Developers Console → 功能切換 → 改為「接受邀請」 |
| Bot 在群組無回應 | LINE OA Manager 回應設定未啟用 Webhook | 停用聊天、停用自動回應、啟用 Webhook |
| 無法直接建 Messaging API Channel | LINE 2024 年後改版流程 | 改從 LINE OA Manager → 擴充功能 → Messaging API 啟用 |
| 月底日期跨時區消失（例：6/30 費用找不到） | `new Date(y, m, 0).toISOString()` 在 UTC+8 環境回傳前一天（本地 00:00 = UTC 前日 16:00） | 改用 `new Date(y, m, 0).getDate()` 取天數後手動組日期字串，不走 ISO |
| 跨月儲存費用後列表不切換 | `onAdded()` 未傳回儲存日期，父元件不知要切換月份 | `onAdded(form.date)` 傳日期，父元件比對月份後呼叫 `setMonth(savedMonth)` |
| 結清 Modal 成功畫面沒出現 | `handleSubmit` 呼叫 `onSaved()` 導致 Modal 被 unmount，`setSaved(true)` 的 re-render 無效 | 移除 `handleSubmit` 內的 `onSaved()`；改在「完成」和「分享」按鈕分別呼叫 |
| `liff.sendMessages()` 結清分享失敗 | 需要 LIFF `chat_message.write` scope，沒設定時靜默失敗，不顯示錯誤 | 改用 `openLineShare()` LINE URL scheme，不需額外 scope |
| 月報類別 icon 不顯示 | MonthlyTab `CAT_CONFIG` 用舊 key（`utilities` 等），AddExpenseModal 已改用新 key（`food`、`housing` 等） | 更新 MonthlyTab `CAT_CONFIG` 對應新 key，保留舊 key 作 fallback |
| 新增費用 Sheet 出現橫向 scrollbar | 外層 container 只設 `overflow-y-auto`，幣別 pills 的 overflow 撐開父層 | 加 `overflow-x-hidden` 到 sheet container |
| Edit mode 換幣匯率不更新（如台幣改日圓變 1:1） | `fetchRate` 被 `if (!isEdit)` 完全阻擋 | 改為 `if (!isEdit \|\| c.code !== form.currency)` — 換幣就抓，不換幣保留自訂值 |
| 匯率空白或 0 時存入錯誤數值 | `onBlur` 沒有 fallback | 加 `liveRate` state，`onBlur` 時若值為空或 0 自動還原到最後抓到的匯率 |

---

## 環境指令

```bash
# 本機開發（port 5174）
cd /Users/cc.hsien/work/roomiepay
npm run dev

# 建置確認
npm run build

# 部署 Production
npx vercel /Users/cc.hsien/work/roomiepay --prod
```

**`.env` 必要變數：**
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxx
VITE_LIFF_ID=（LINE Developers Console 取得）
SUPABASE_SERVICE_ROLE_KEY=（後端 api/auth.js 用，只放 Vercel 環境變數）
```

**Vercel 上也要設定相同的環境變數**（`npx vercel env add`）。

---

## 外部服務設定對照

| 服務 | 設定項目 | 目前值 |
|------|---------|--------|
| Cloudflare | 域名 | `washcc.cc`（$8/年，2026-06-23 起）|
| Vercel | Project Name | `waripay` |
| Vercel | Production Domain | `www.washcc.cc` |
| Vercel | 舊域名 | `waripay-peach.vercel.app`（仍有效）|
| Supabase | Site URL | `https://waripay-peach.vercel.app` |
| Supabase | Redirect URLs | `https://waripay-peach.vercel.app` |
| LINE LIFF | Endpoint URL | `https://www.washcc.cc` |
| LINE Messaging API | Webhook URL | `https://www.washcc.cc/api/bot` |
| LINE Messaging API | Channel Secret | Vercel env `LINE_CHANNEL_SECRET` |
| LINE Messaging API | Channel Access Token | Vercel env `LINE_CHANNEL_ACCESS_TOKEN` |
