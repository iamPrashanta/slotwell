-- Booking ↔ Google Calendar sync details and a stable calendar-invite identity.

-- Calendar the Google event was created in (needed to update/delete it later).
ALTER TABLE bookings ADD COLUMN google_calendar_id text;
-- Last Google sync error (null when in sync). Shown on the dashboard for retry.
ALTER TABLE bookings ADD COLUMN sync_error text;
-- .ics UID shared by a booking and every reschedule of it, so calendar apps update one event.
ALTER TABLE bookings ADD COLUMN ics_uid text;
UPDATE bookings SET ics_uid = id::text || '@slotwell' WHERE ics_uid IS NULL;
ALTER TABLE bookings ALTER COLUMN ics_uid SET NOT NULL;

CREATE INDEX bookings_sync_error_idx ON bookings (owner_id) WHERE sync_error IS NOT NULL;
