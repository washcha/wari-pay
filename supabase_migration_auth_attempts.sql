-- ============================================================
-- Rate-limit table for /api/auth
-- Keeps a short rolling window of attempts per IP to throttle
-- Google OAuth account-farming without needing extra infra.
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_attempts (
  id         BIGSERIAL PRIMARY KEY,
  ip         TEXT NOT NULL,
  provider   TEXT NOT NULL,          -- 'google' | 'line' | 'test'
  succeeded  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_time
  ON auth_attempts (ip, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_created_at
  ON auth_attempts (created_at);

-- RLS: only service role touches this table; deny everyone else.
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated. Service role bypasses RLS.

-- Optional housekeeping (run manually or via pg_cron if desired):
-- DELETE FROM auth_attempts WHERE created_at < NOW() - INTERVAL '7 days';
