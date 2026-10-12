-- Add a locked base currency for rooms.
-- Safe to run on existing data: backfills old rooms to TWD.

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS base_currency VARCHAR NOT NULL DEFAULT 'TWD';

UPDATE rooms
SET base_currency = 'TWD'
WHERE base_currency IS NULL OR base_currency = '';
