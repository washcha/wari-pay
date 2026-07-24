-- 室友分帳趣 RoomiePay - Database Schema
-- 直接貼到 Supabase Dashboard > SQL Editor 執行

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 費用類別 enum（同時服務分帳 & 記帳月報功能）
CREATE TYPE expense_category AS ENUM (
  'food',           -- 餐飲
  'clothing',       -- 服飾
  'housing',        -- 住宿
  'transport',      -- 交通
  'entertainment',  -- 育樂
  'other',          -- 其他
  'utilities',      -- 水電瓦斯（舊）
  'groceries',      -- 食品雜貨（舊）
  'supplies',       -- 生活用品（舊）
  'rent'            -- 租金（舊）
);

-- 1. 使用者 (LINE UID 驅動)
CREATE TABLE users (
  id            VARCHAR PRIMARY KEY,        -- LINE userId
  display_name  VARCHAR NOT NULL,           -- LINE 暱稱
  picture_url   TEXT,                       -- LINE 頭像
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 房間
CREATE TABLE rooms (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        VARCHAR NOT NULL,
  created_by  VARCHAR REFERENCES users(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 房間成員 (多對多)
CREATE TABLE room_members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id    UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 4. 費用主表（含類別 & 日期，支援月報功能）
CREATE TABLE expenses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id       UUID REFERENCES rooms(id) ON DELETE CASCADE,
  paid_by       VARCHAR REFERENCES users(id),
  amount        NUMERIC(12, 2) NOT NULL,
  title         VARCHAR NOT NULL,
  category      expense_category DEFAULT 'other',
  note          TEXT,
  expense_date  DATE DEFAULT CURRENT_DATE,  -- 記帳日期（非建立時間），月報用此欄位篩選
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 費用分攤明細
CREATE TABLE expense_splits (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id    UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id       VARCHAR REFERENCES users(id),
  split_amount  NUMERIC(12, 2) NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security（MVP 先全開，正式上線後搭配 Supabase Auth 收緊）
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_users"          ON users          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_rooms"          ON rooms          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_room_members"   ON room_members   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_expenses"       ON expenses       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_expense_splits" ON expense_splits FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 結算邏輯備忘（前端直接 query，不需要 stored procedure）
--
-- 某月某房間每人差額：
--   paid  = SELECT SUM(amount) FROM expenses WHERE room_id=? AND paid_by=user_id AND expense_date BETWEEN ...
--   owed  = SELECT SUM(split_amount) FROM expense_splits WHERE expense_id IN (月內 expenses.id) AND user_id=?
--   delta = paid - owed
--   > 0  → 可收回（幫大家墊了錢）
--   < 0  → 需補繳（欠別人錢）
-- ============================================================
