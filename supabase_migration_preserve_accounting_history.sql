-- Wari Pay - Preserve accounting history when users leave/delete account
-- Safe characteristics:
-- - Adds nullable status columns only
-- - Does not delete, overwrite, or backfill existing ledger rows
-- - Existing active memberships remain active because left_at defaults to NULL

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE room_members
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON users(deleted_at);

CREATE INDEX IF NOT EXISTS idx_room_members_left_at
  ON room_members(room_id, left_at);

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
