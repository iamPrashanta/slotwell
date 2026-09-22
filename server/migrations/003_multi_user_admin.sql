-- Multi-user accounts, admin role, admin 2FA and audit log.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS banned_at timestamptz;
CREATE INDEX IF NOT EXISTS user_created_idx ON "user" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS session_user_idx ON session ("userId", "updatedAt" DESC);

-- Usernames share the URL space with app routes, so keep a wider reserved list.
ALTER TABLE owner_settings DROP CONSTRAINT IF EXISTS owner_settings_username_check;
ALTER TABLE owner_settings ADD CONSTRAINT owner_settings_username_check CHECK (
  username ~ '^[a-z0-9][a-z0-9-]{1,38}$'
  AND username NOT IN (
    'api', 'login', 'logout', 'signup', 'register', 'dashboard', 'embed', 'booking', 'bookings', 'admin',
    'onboarding', 'settings', 'account', 'pricing', 'billing', 'help', 'support', 'about', 'terms', 'privacy',
    'blog', 'docs', 'status', 'www', 'app', 'static', 'assets', 'slotwell', 'root', 'system'
  )
);

-- One TOTP secret per admin. secret_enc is AES-256-GCM encrypted; backup codes are SHA-256 hashes.
CREATE TABLE admin_totp (
  user_id       text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  secret_enc    text NOT NULL,
  confirmed_at  timestamptz,
  last_step     bigint NOT NULL DEFAULT 0,
  backup_codes  text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_audit_log (
  id            bigserial PRIMARY KEY,
  admin_id      text REFERENCES "user"(id) ON DELETE SET NULL,
  action        text NOT NULL,
  target_type   text,
  target_id     text,
  details       jsonb NOT NULL DEFAULT '{}',
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX bookings_created_idx ON bookings (created_at DESC);
