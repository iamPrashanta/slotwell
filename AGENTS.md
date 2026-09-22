<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

- Slotwell is a single-owner scheduler. Read `docs/ARCHITECTURE.md` before changing data flow, and `docs/ROADMAP.md` for what is in scope.
- Store all times in UTC (`timestamptz`); convert with the helpers in `src/lib/availability/time.ts`. Never hand-roll offsets.
- The availability engine (`src/lib/availability/`) must stay dependency-free and covered by `npm test`.
- Double-booking protection lives in PostgreSQL (`bookings_no_overlap`). Don't replace it with application-only checks.
- Validate every API input with Zod. Never log tokens, secrets or guest personal data.
- Schema changes go in a new numbered file in `server/migrations/`; never edit an applied migration.

## Local runtime preference

Use Podman CLI for Compose and all local container work; do not use Docker CLI. Skip containers when local build/browser checks are sufficient. Do not migrate or delete existing database volumes without an explicit request.

## Production

The production server is shared with other sites and apps. Follow `.agents/skills/deploy-to-prod/SKILL.md` exactly and never touch other sites, services or Nginx without asking.
