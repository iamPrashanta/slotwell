# Slotwell — multi-user & admin panel plan

Slotwell moves from "one owner" to **anyone can sign up and get their own booking page**.
You (the operator) monitor everything from a separate, locked-down **admin panel**.
Subscriptions come later; this plan leaves room for them.

## 1. Two areas, one app

| Area | Route | Who | Sign-in |
|---|---|---|---|
| Public booking pages | `/:username`, `/:username/:event`, `/embed/*`, `/booking/:token` | Guests (no account) | — |
| User panel | `/dashboard/*`, `/onboarding` | Every signed-up user (you too) | `/login` — Google (demo: email + password) |
| Admin panel | `/admin/*` | Accounts with `role = 'admin'` | `/admin/login` — same account **+ TOTP 2FA step-up** |

An admin is a normal user with an extra role, so you keep using `/dashboard` for your own bookings.

## 2. Accounts & roles

- `user.role`: `user` | `admin` (default `user`).
- `user.banned`, `ban_reason`, `banned_at`: a banned user can't sign in, all sessions are revoked,
  and their public booking pages return 404.
- **Bootstrap admins** with `ADMIN_EMAILS` (comma-separated). Applied on sign-up and on every `db:migrate`
  (promote only — demoting is done in the admin panel).
- `SIGNUPS_OPEN=false` is a kill switch: only `ADMIN_EMAILS` can create accounts.
- New users land on **`/onboarding`**: pick username, display name and time zone → default
  Mon–Fri 10:00–18:00 hours and a 30-minute meeting type are created.

## 3. Admin authentication (defence in depth)

1. `/admin/login` step 1 — normal session (Google / demo password).
2. Step 2 — account must have `role = 'admin'` and not be banned. Others get a plain "no access" page.
3. Step 3 — **TOTP 2FA** (Google Authenticator, 1Password, …):
   - First visit: QR code + secret → confirm a code → 10 one-time **backup codes** shown once.
   - Secret stored **AES-256-GCM encrypted** (key derived from `BETTER_AUTH_SECRET`); backup codes stored hashed.
   - ±1 time-step window, replay of a used code rejected, 5 attempts / 10 min rate limit.
4. Success sets `sw_admin`: an **HMAC-signed, httpOnly, SameSite=Strict** cookie bound to the current
   session id, valid **8 hours**. Signing out, a new session, a ban or losing the role invalidates it.
5. Every admin page **and every admin Server Action** calls `requireAdmin()` (layouts alone don't protect actions).
6. Every admin action is written to **`admin_audit_log`** (who, what, target, IP, time) — including failed 2FA.

## 4. Admin panel pages

| Route | What you see / do |
|---|---|
| `/admin` | KPIs (users, new users 7d/30d, active users, bookings, upcoming 7d, cancel rate, sync errors), 30-day signups & bookings chart, recent sign-ups, recent bookings, top hosts, system health |
| `/admin/users` | Search (name, email, username), filter (active, banned, admins, not onboarded), sort, pagination |
| `/admin/users/:id` | Profile, booking page link, meeting types, recent bookings, sessions (IP, device, last seen). Actions: ban / unban with reason, revoke sessions, grant / remove admin (never yourself) |
| `/admin/bookings` | All bookings across users. Search guest / host, filter status, upcoming / past, sync errors. Cancel a booking (guest is emailed) |
| `/admin/audit` | Admin audit log |
| `/admin/security` | Your 2FA status, regenerate backup codes, lock admin session |

## 5. Data changes (`server/migrations/003_multi_user_admin.sql`)

- `"user"`: `role`, `banned`, `ban_reason`, `banned_at`.
- `admin_totp` (user_id, secret_enc, confirmed_at, last_step, backup_codes[]).
- `admin_audit_log` (id, admin_id, action, target_type, target_id, details jsonb, ip, created_at).
- Indexes for admin queries (created_at on users/bookings).
- Wider reserved-username list (admin, onboarding, settings, pricing, signup, support, …).

## 6. Using it (local)

1. `npm run podman:up:windows`, then open http://localhost:3004/admin/login.
2. Sign in with your own account (the `ADMIN_EMAILS` / `OWNER_EMAIL` one).
3. Scan the QR code with an authenticator app, enter the code, **save the 10 backup codes**.
4. Next time: sign in → 6-digit code → admin for 8 hours. "Lock admin" ends it early.

`npm run test:e2e` runs 37 end-to-end checks against the running container (sign-up, onboarding,
guards, 2FA setup, replay and brute-force protection, backup codes, suspend / unsuspend, roles, audit log).
It creates throwaway `*@e2e.test` accounts and deletes them afterwards.

## 7. Later phases

- **Subscriptions** (Stripe or Razorpay): `plans`, `subscriptions` tables; limits per plan
  (meeting types, bookings/month, custom branding, remove "Powered by Slotwell", team pages).
  Admin panel gets a Revenue page, plan overrides per user and coupon management.
- Email log (every notification + delivery status) and a resend button.
- Impersonate user (read-only, audited) for support.
- Abuse tools: report page, sign-up throttles per IP, disposable-email block.
- Moving the in-memory rate limiter to PostgreSQL/Redis if Slotwell runs more than one process.
