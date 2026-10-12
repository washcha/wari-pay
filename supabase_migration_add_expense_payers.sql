-- Wari Pay - add multi-payer support
-- Safe production migration:
-- - Adds a new table only
-- - Does not update, delete, or backfill existing expenses
-- - Existing expenses keep using expenses.paid_by as fallback in the app

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

ALTER TABLE expense_payers ENABLE ROW LEVEL SECURITY;

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
