# Google OAuth 設定指南

Phase A：Google 登入上線前的手動設定步驟。只動指定欄位，其他**不要碰**。

---

## 1. Supabase：執行遷移（新 table）

Supabase Dashboard → **SQL Editor** → New query，貼入並執行：

```
檔案：supabase_migration_auth_attempts.sql
```

這會建立 `auth_attempts` table（用於 rate limit）。不影響既有資料。

---

## 2. Google Cloud Console：建立 OAuth 2.0 Client ID

1. 進入 [Google Cloud Console](https://console.cloud.google.com/)
2. 新建 Project（或用現有的），例：`Wari Pay`
3. 左側選單 → **APIs & Services** → **OAuth consent screen**
   - User Type：**External**
   - App name：`Wari Pay`
   - User support email：你的 email
   - Developer contact：你的 email
   - **Scopes**：點 Add → 勾選 `openid`、`.../auth/userinfo.email`、`.../auth/userinfo.profile`（只選這三個，不要加其他）
   - Test users：測試期可以加你自己的 Gmail
   - 送出 → Publishing status 之後改成 **In production** 才能給所有人用
4. **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type：**Web application**
   - Name：`Wari Pay Web`
   - **Authorized JavaScript origins**：
     - `https://washcc.cc`
     - `https://www.washcc.cc`
     - `http://localhost:5173`（本地開發）
   - **Authorized redirect URIs**：留空（我們用 GIS popup，不需要 redirect URI）
   - Create → 複製 **Client ID**（長得像 `xxxxxxxx.apps.googleusercontent.com`）

---

## 3. Vercel：設定環境變數

Vercel Dashboard → `roomiepay` project → **Settings** → **Environment Variables**

新增以下三個（Environment 選 **Production + Preview + Development**）：

| Name | Value |
|------|-------|
| `GOOGLE_OAUTH_CLIENT_ID` | 剛剛拿到的 Client ID |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | 同上（Vite 需要這個 prefix 才會曝到前端） |

本地開發要同一套：把這兩行加到 `.env.local`。

> **注意：Google OAuth Client Secret 不需要**。我們用 GIS 的 ID token 流程，Client Secret 只在 server-to-server 流程才會用到。

---

## 4. 部署

```bash
git add .
git commit -m "feat(auth): add Google OAuth with rate limiting"
git push
```

Vercel 會自動 build & deploy。

---

## 5. 驗收

- [ ] LINE 用戶原本的登入流程不變，資料完全沒受影響
- [ ] Login 頁出現「以 Google 帳號登入」按鈕
- [ ] 按下 Google 按鈕 → 跳 Google 授權視窗 → 成功登入 → 進入 app
- [ ] Google 登入後的用戶 ID 格式為 `google-{sub}`
- [ ] `auth_attempts` table 有看到成功的紀錄
- [ ] 連續試 11 次 Google 登入 → 第 11 次被 429 擋
- [ ] 用 `test@mailinator.com` 試 → 被 403 擋

---

## 架構說明

### 用戶 ID 格式
- LINE：`Uabc123...`（LINE userId，不變）
- Google：`google-{sub}`（Google OpenID sub）
- 兩種互不衝突，RLS 自動隔離

### 資料儲存
- `users` table：**不存 email**，只存 userId / display_name / picture_url
- Supabase Auth 內部會存 Google email（用於 provider mapping），但我們的 `users` table 看不到
- 未來若要加 email 通知：`ALTER TABLE users ADD COLUMN email TEXT`，不需要 migration 舊資料

### 防濫用
- **Rate limit**：每個 IP 每小時最多 **10 次「失敗」** `/api/auth` 嘗試；成功登入不扣額度（避免辦公室/咖啡廳共用 IP 的多人正常使用被誤擋）
- **Disposable email**：擋 ~120,000+ 已知拋棄式信箱域名（`disposable-email-domains` 套件）
- **Google email_verified 檢查**：拒絕未驗證 email 的 Google 帳號

### 已知限制（Phase A）
- **Google 用戶 session 1 小時後過期**：Supabase JWT 預設 1 小時 TTL，過期後 Google 用戶會被登出，需重新按一次 Google 按鈕登入。LINE 用戶因為 LIFF 每次開啟都會自動 re-auth 所以感知不到；Google 用戶會明顯感覺到。
- **解法（之後再做）**：Phase B 可改用 Supabase 原生 Google OAuth provider（支援 refresh token），或在 client 端做靜默 refresh。
- **目前的影響**：對於只偶爾使用的 Google 用戶無感；對於長時間連續使用的用戶，每小時需要重登入一次。

### 隱私政策
Google 登入上線前，記得更新 `src/pages/PrivacyPolicy.jsx` 加入：
- 新增 Google 身份識別
- 說明 Google 提供的 email 僅用於識別，不儲存在應用資料庫
