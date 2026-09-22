-- Slotwell v0.1 schema. Times are stored in UTC (timestamptz).
-- Requires the Better Auth tables ("user", session, account, verification) to exist first.

-- btree_gist lets the overlap constraint combine owner_id (=) with time ranges (&&).
-- It is a trusted extension (PostgreSQL 13+), so the database owner can create it.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE owner_settings (
  owner_id              text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  username              text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9][a-z0-9-]{1,38}$' AND username NOT IN ('api', 'login', 'dashboard', 'embed', 'booking', 'admin')),
  display_name          text NOT NULL DEFAULT '',
  bio                   text NOT NULL DEFAULT '',
  time_zone             text NOT NULL DEFAULT 'UTC',
  -- Calendars checked for busy times, and the one new events are written to.
  busy_calendar_ids     text[] NOT NULL DEFAULT ARRAY['primary'],
  booking_calendar_id   text NOT NULL DEFAULT 'primary',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_types (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  slug                  text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,48}$'),
  title                 text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description           text NOT NULL DEFAULT '',
  duration_min          integer NOT NULL CHECK (duration_min BETWEEN 5 AND 480),
  location_kind         text NOT NULL DEFAULT 'google_meet' CHECK (location_kind IN ('google_meet', 'phone', 'custom')),
  location_value        text NOT NULL DEFAULT '',
  buffer_before_min     integer NOT NULL DEFAULT 0 CHECK (buffer_before_min BETWEEN 0 AND 240),
  buffer_after_min      integer NOT NULL DEFAULT 10 CHECK (buffer_after_min BETWEEN 0 AND 240),
  min_notice_min        integer NOT NULL DEFAULT 240 CHECK (min_notice_min >= 0),
  max_days_ahead        integer NOT NULL DEFAULT 60 CHECK (max_days_ahead BETWEEN 1 AND 365),
  slot_interval_min     integer NOT NULL DEFAULT 30 CHECK (slot_interval_min BETWEEN 5 AND 240),
  daily_limit           integer CHECK (daily_limit IS NULL OR daily_limit > 0),
  -- [{ "id": "budget", "label": "Budget", "type": "text" | "textarea" | "select", "required": true, "options": [] }]
  questions             jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active             boolean NOT NULL DEFAULT true,
  position              integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);

-- Weekly working hours in the owner's time zone. weekday: 1 = Monday … 7 = Sunday (ISO 8601).
CREATE TABLE availability_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  weekday               smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time            time NOT NULL,
  end_time              time NOT NULL,
  CHECK (start_time < end_time)
);
CREATE INDEX availability_rules_owner_idx ON availability_rules (owner_id, weekday);

-- Replaces the weekly rules for one date: a day off (is_unavailable) or custom ranges.
CREATE TABLE date_overrides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  date                  date NOT NULL,
  is_unavailable        boolean NOT NULL DEFAULT false,
  start_time            time,
  end_time              time,
  CHECK (
    (is_unavailable AND start_time IS NULL AND end_time IS NULL)
    OR (NOT is_unavailable AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);
CREATE INDEX date_overrides_owner_date_idx ON date_overrides (owner_id, date);

CREATE TABLE bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  event_type_id         uuid NOT NULL REFERENCES event_types(id) ON DELETE RESTRICT,
  start_at              timestamptz NOT NULL,
  end_at                timestamptz NOT NULL,
  -- The meeting plus its buffers; used by the overlap constraint.
  blocked               tstzrange NOT NULL,
  status                text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  guest_name            text NOT NULL CHECK (length(guest_name) BETWEEN 1 AND 120),
  guest_email           text NOT NULL CHECK (length(guest_email) BETWEEN 3 AND 254),
  guest_time_zone       text NOT NULL DEFAULT 'UTC',
  notes                 text NOT NULL DEFAULT '',
  answers               jsonb NOT NULL DEFAULT '{}'::jsonb,
  location_url          text,
  google_event_id       text,
  -- Only a SHA-256 hash of the guest's manage-link token is stored.
  manage_token_hash     text NOT NULL UNIQUE,
  ics_sequence          integer NOT NULL DEFAULT 0,
  cancel_reason         text,
  cancelled_at          timestamptz,
  rescheduled_from_id   uuid REFERENCES bookings(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK (lower(blocked) <= start_at AND upper(blocked) >= end_at),
  -- Two confirmed bookings for the same owner can never overlap (buffers included).
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (owner_id WITH =, blocked WITH &&) WHERE (status = 'confirmed')
);
CREATE INDEX bookings_owner_start_idx ON bookings (owner_id, start_at);
CREATE INDEX bookings_guest_email_idx ON bookings (lower(guest_email));
