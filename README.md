# Slotwell

**Book a time. No back-and-forth.**

Slotwell is a minimal, self-hosted scheduling tool. Share a link, let people pick a free slot from your real Google Calendar, and get a confirmed meeting with a Google Meet link — shown in each person's own time zone. It is built for one owner (a freelancer or consultant) and anonymous guests.

- **Planned URL:** https://slotwell.app/iamprashanta/30min (domain not bought yet)
- **Used by:** https://prashanta.dev ("Start a Project" and the contact page)
- **Status:** v0.1 in development — see [docs/ROADMAP.md](docs/ROADMAP.md)

## Features (v0.1 target)

- Real-time availability from Google Calendar (free/busy)
- Meeting types with their own length, buffers, notice, booking window, daily limit and questions
- Weekly hours plus date overrides (days off, special hours)
- Automatic guest time zone, 12h/24h toggle
- Google Calendar event with a Meet link; confirmation emails with an `.ics` invite
- Cancel/reschedule from a link in the email
- Inline or popup embed for your own website (`/embed/...`), light or dark
- Double-booking prevented by PostgreSQL itself

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 17 (`pg`) · Better Auth (Google only) · Google Calendar API v3 · Nodemailer · Zod. The same stack as the Freelancer Invoice Generator.

## Quick start (local)

Requires Node.js 22.18+ and Podman with a Compose provider.

```sh
cp .env.example .env.local        # fill in DB_PASSWORD, BETTER_AUTH_SECRET, OWNER_EMAIL, Google keys
npm install
npm run db:up                     # PostgreSQL on 5433, Mailpit on 1026 (UI http://localhost:18026)
npm run db:migrate
npm run dev                       # http://localhost:3004
```

Then open http://localhost:3004/login, sign in with the Google account set in `OWNER_EMAIL`, and visit `http://localhost:3004/<OWNER_USERNAME>/30min`.

Google setup (OAuth client, scopes, test users) is in [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3004 |
| `npm run check` | Typecheck + lint + tests (run before every commit/deploy) |
| `npm test` | Unit tests: availability engine and calendar invites (Node's built-in test runner) |
| `npm run test:db` | Runs the migrations on in-memory PostgreSQL (PGlite) and checks the double-booking rules |
| `npm run db:up` / `db:down` | Start/stop local PostgreSQL and Mailpit (Podman) |
| `npm run db:migrate` | Apply Better Auth schema + `server/migrations/*.sql` |

## URLs

| Path | Purpose |
| --- | --- |
| `/` | Product page |
| `/{username}` | Owner profile with meeting types |
| `/{username}/{event}` | Booking page (`?theme=light|dark`, `?topic=cloud-migration`) |
| `/embed/{username}/{event}` | Chrome-less booking page for iframes |
| `/booking/{token}` | Guest's manage page (link in the confirmation email): reschedule or cancel |
| `/login`, `/dashboard` | Owner sign-in and dashboard |
| `/api/slots`, `/api/bookings`, `/api/bookings/{token}/cancel`, `/api/health` | Public API and health check |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Google setup](docs/GOOGLE_SETUP.md)
- [Embedding on another site](docs/EMBEDDING.md)
- [Brand](docs/BRAND.md)
