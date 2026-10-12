-- Wari Pay - Multi-payer production release migration
-- Run this once before deploying the multi-payer app changes.
--
-- Safety:
-- - Adds nullable/new columns and a new table only
-- - Does not delete, truncate, overwrite, or backfill existing ledger rows
-- - Existing rooms, members, expenses, splits, and settlements remain intact

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR NOT NULL DEFAULT 'TWD';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE room_members
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS expense_payers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id   UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id      VARCHAR NOT NULL REFERENCES users(id),
  amount_paid  NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(expense_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_payers_expense_id
  ON expense_payers(expense_id);

CREATE INDEX IF NOT EXISTS idx_expense_payers_user_id
  ON expense_payers(user_id);

CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON users(deleted_at);

CREATE INDEX IF NOT EXISTS idx_room_members_left_at
  ON room_members(room_id, left_at);

ALTER TABLE expense_payers ENABLE ROW LEVEL SECURITY;

-- Active room membership is required for current access and future writes.
-- Historical membership rows are kept so old expenses/splits/payers still resolve.
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
      AND left_at IS NULL
  );
$$;

DROP POLICY IF EXISTS "room_members_select" ON room_members;
DROP POLICY IF EXISTS "room_members_update" ON room_members;

CREATE POLICY "room_members_select" ON room_members
  FOR SELECT TO authenticated
  USING (
    user_id = current_line_user_id() OR is_room_member(room_id)
  );

CREATE POLICY "room_members_update" ON room_members
  FOR UPDATE TO authenticated
  USING (
    user_id = current_line_user_id() OR is_room_member(room_id)
  )
  WITH CHECK (
    user_id = current_line_user_id() OR is_room_member(room_id)
  );

DROP POLICY IF EXISTS "expense_payers_select" ON expense_payers;
DROP POLICY IF EXISTS "expense_payers_insert" ON expense_payers;
DROP POLICY IF EXISTS "expense_payers_update" ON expense_payers;
DROP POLICY IF EXISTS "expense_payers_delete" ON expense_payers;

CREATE POLICY "expense_payers_select" ON expense_payers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_payers.expense_id
        AND is_room_member(e.room_id)
    )
  );

CREATE POLICY "expense_payers_insert" ON expense_payers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_payers.expense_id
        AND is_room_member(e.room_id)
    )
  );

CREATE POLICY "expense_payers_update" ON expense_payers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_payers.expense_id
        AND is_room_member(e.room_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_payers.expense_id
        AND is_room_member(e.room_id)
    )
  );

CREATE POLICY "expense_payers_delete" ON expense_payers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_payers.expense_id
        AND is_room_member(e.room_id)
    )
  );
