# Roadmap

v0.1 is done when a stranger can book a free intro call from prashanta.dev and it appears in the owner's Google Calendar with a Meet link.

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 — Foundation | Project setup, Postgres + Mailpit, migrations, Better Auth (Google, owner-only), default seed | Done (scaffold) |
| M1 — Availability | Slot engine + tests, `/api/slots`, Google free/busy client, booking widget UI | Done (needs a real Google test) |
| M2 — Booking | `POST /api/bookings`: fresh re-check, transactional insert, Google event + Meet link, emails with `.ics`, rate limit | Done (needs a real Google + SMTP test) |
| M3 — Manage + dashboard | `/booking/[token]` cancel/reschedule (done), editors for meeting types, weekly hours and overrides | In progress |
| M3.5 — Multi-user + admin | Open sign-up, onboarding, `/admin` with 2FA — see docs/ADMIN.md | In progress |
| M4 — Launch | Domain + HTTPS, deploy to the shared server, prashanta.dev `booking.embedEnabled = true` | Planned |

## M2 — done

- [x] `src/server/bookings.ts`: fresh slot re-check, transactional insert; `bookings_no_overlap` (SQLSTATE `23P01`) → "That time was just taken".
- [x] Manage token: 32 random bytes, only the SHA-256 hash is stored.
- [x] Google event with Meet link (`requestId` = booking id); failures are kept in `sync_error` and shown on the dashboard.
- [x] `src/server/email.ts` + `src/lib/ics.ts`: guest invite (`METHOD:REQUEST`/`CANCEL`, stable `UID`, rising `SEQUENCE`), owner notice with the guest's answers.
- [x] Rate limits: bookings 5 per IP per 10 min, cancels 10 per 10 min, slots 60 per minute; honeypot submissions are silently ignored.
- [x] Guest manage page `/booking/[token]` with cancel and reschedule (the booking page's `?reschedule=` flow).

## M3 — next

- [ ] Dashboard editors: meeting types (incl. custom questions), weekly hours, date overrides, profile/time zone.
- [ ] Owner cancel from the dashboard, and "retry Google sync" for bookings with `sync_error`.
- [ ] Choose which calendars count as busy (`busy_calendar_ids`) from the connected account.

## After v0.1

- **v0.2:** reminder emails (24 h / 1 h), prefill and UTM tracking, simple stats, webhook on booking.
- **v0.3:** Outlook and CalDAV calendars, Zoom, routing questions.
- **v1.0 (only if others want it):** public sign-up with per-user limits, Stripe paid bookings.

## M3.5 — Multi-user + admin panel (in progress)
- [x] Open sign-up with `/onboarding` (username, name, time zone, default hours + meeting type)
- [x] Roles (`user` / `admin`), suspensions, `ADMIN_EMAILS`, `SIGNUPS_OPEN`
- [x] `/admin/login` with TOTP 2FA, backup codes, signed 8-hour admin cookie
- [x] Admin: overview, users, user detail, all bookings, audit log, security
- [ ] Subscriptions and plan limits — see docs/ADMIN.md §6

