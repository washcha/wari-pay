-- ============================================================
-- RoomiePay RLS Migration
-- 替換 MVP 階段的 USING (true) 政策，改成基於 JWT app_metadata.line_user_id
-- ============================================================
-- 直接貼到 Supabase Dashboard > SQL Editor 執行
-- 跑完後立刻測試 App 是否正常（如果壞了就 ROLLBACK 那段在最下面）

-- ============================================================
-- 1. Helper Functions
-- ============================================================

-- 從 JWT 取得當前使用者的 LINE userId
CREATE OR REPLACE FUNCTION public.current_line_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt()->'app_metadata'->>'line_user_id', '');
$$;

-- 判斷當前使用者是否為某房間的成員（用 SECURITY DEFINER 避免 RLS 自我遞迴）
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id
      AND user_id = public.current_line_user_id()
  );
$$;

-- ============================================================
-- 2. 移除舊的全開政策
-- ============================================================
DROP POLICY IF EXISTS "public_users"          ON users;
DROP POLICY IF EXISTS "public_rooms"          ON rooms;
DROP POLICY IF EXISTS "public_room_members"   ON room_members;
DROP POLICY IF EXISTS "public_expenses"       ON expenses;
DROP POLICY IF EXISTS "public_expense_splits" ON expense_splits;

-- ============================================================
-- 3. users：登入用戶都能讀（顯示室友資訊），只能改自己
-- ============================================================
CREATE POLICY "users_select_all" ON users
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "users_insert_self" ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = current_line_user_id());

CREATE POLICY "users_update_self" ON users
  FOR UPDATE TO authenticated
  USING (id = current_line_user_id())
  WITH CHECK (id = current_line_user_id());

-- ============================================================
-- 4. rooms：成員可讀/改名；任何登入用戶可建（必須是自己當 creator）；只有 creator 可刪
-- ============================================================
-- creator OR member 都能看（INSERT...RETURNING 時 creator 還沒加進 room_members，所以需要 OR）
CREATE POLICY "rooms_select_member" ON rooms
  FOR SELECT TO authenticated
  USING (is_room_member(id) OR created_by = current_line_user_id());

CREATE POLICY "rooms_insert_self" ON rooms
  FOR INSERT TO authenticated
  WITH CHECK (created_by = current_line_user_id());

CREATE POLICY "rooms_update_member" ON rooms
  FOR UPDATE TO authenticated
  USING (is_room_member(id))
  WITH CHECK (is_room_member(id));

CREATE POLICY "rooms_delete_creator" ON rooms
  FOR DELETE TO authenticated
  USING (created_by = current_line_user_id());

-- ============================================================
-- 5. room_members：同房間成員可看；任何人可加自己進房（用於 invite link）；成員可加/移除他人
-- ============================================================
CREATE POLICY "room_members_select" ON room_members
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

CREATE POLICY "room_members_insert" ON room_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = current_line_user_id() OR is_room_member(room_id)
  );

CREATE POLICY "room_members_delete" ON room_members
  FOR DELETE TO authenticated
  USING (
    user_id = current_line_user_id() OR is_room_member(room_id)
  );

-- ============================================================
-- 6. expenses：房間成員 CRUD
-- ============================================================
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT TO authenticated USING (is_room_member(room_id));

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT TO authenticated WITH CHECK (is_room_member(room_id));

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE TO authenticated
  USING (is_room_member(room_id))
  WITH CHECK (is_room_member(room_id));

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE TO authenticated USING (is_room_member(room_id));

-- ============================================================
-- 7. expense_splits：透過 expense → room 判斷
-- ============================================================
CREATE POLICY "expense_splits_select" ON expense_splits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id
        AND is_room_member(e.room_id)
    )
  );

CREATE POLICY "expense_splits_insert" ON expense_splits
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id
        AND is_room_member(e.room_id)
    )
  );

CREATE POLICY "expense_splits_update" ON expense_splits
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id
        AND is_room_member(e.room_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id
        AND is_room_member(e.room_id)
    )
  );

CREATE POLICY "expense_splits_delete" ON expense_splits
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_splits.expense_id
        AND is_room_member(e.room_id)
    )
  );

-- ============================================================
-- 8. settlement_payments：如果表存在就加上政策（房間成員可看；只能 CRUD 自己的結算記錄）
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'settlement_payments'
  ) THEN
    EXECUTE 'ALTER TABLE settlement_payments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_settlement_payments" ON settlement_payments';

    EXECUTE $p$
      CREATE POLICY "settlement_payments_select" ON settlement_payments
        FOR SELECT TO authenticated USING (is_room_member(room_id))
    $p$;

    EXECUTE $p$
      CREATE POLICY "settlement_payments_insert" ON settlement_payments
        FOR INSERT TO authenticated
        WITH CHECK (is_room_member(room_id) AND payer_id = current_line_user_id())
    $p$;

    EXECUTE $p$
      CREATE POLICY "settlement_payments_update" ON settlement_payments
        FOR UPDATE TO authenticated
        USING (payer_id = current_line_user_id())
        WITH CHECK (payer_id = current_line_user_id())
    $p$;

    EXECUTE $p$
      CREATE POLICY "settlement_payments_delete" ON settlement_payments
        FOR DELETE TO authenticated
        USING (payer_id = current_line_user_id())
    $p$;
  END IF;
END $$;

-- ============================================================
-- ROLLBACK：如果壞了，跑這段把全開政策放回去
-- ============================================================
-- DROP POLICY IF EXISTS "users_select_all"        ON users;
-- DROP POLICY IF EXISTS "users_insert_self"       ON users;
-- DROP POLICY IF EXISTS "users_update_self"       ON users;
-- DROP POLICY IF EXISTS "rooms_select_member"     ON rooms;
-- DROP POLICY IF EXISTS "rooms_insert_self"       ON rooms;
-- DROP POLICY IF EXISTS "rooms_update_member"     ON rooms;
-- DROP POLICY IF EXISTS "rooms_delete_creator"    ON rooms;
-- DROP POLICY IF EXISTS "room_members_select"    ON room_members;
-- DROP POLICY IF EXISTS "room_members_insert"    ON room_members;
-- DROP POLICY IF EXISTS "room_members_delete"    ON room_members;
-- DROP POLICY IF EXISTS "expenses_select"        ON expenses;
-- DROP POLICY IF EXISTS "expenses_insert"        ON expenses;
-- DROP POLICY IF EXISTS "expenses_update"        ON expenses;
-- DROP POLICY IF EXISTS "expenses_delete"        ON expenses;
-- DROP POLICY IF EXISTS "expense_splits_select" ON expense_splits;
-- DROP POLICY IF EXISTS "expense_splits_insert" ON expense_splits;
-- DROP POLICY IF EXISTS "expense_splits_update" ON expense_splits;
-- DROP POLICY IF EXISTS "expense_splits_delete" ON expense_splits;
-- CREATE POLICY "public_users"          ON users          FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_rooms"          ON rooms          FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_room_members"   ON room_members   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_expenses"       ON expenses       FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_expense_splits" ON expense_splits FOR ALL USING (true) WITH CHECK (true);
