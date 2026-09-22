// Creates a demo owner, meeting types and sample bookings for local development.
// Requires DEV_PASSWORD_LOGIN=true, OWNER_EMAIL and DEV_OWNER_PASSWORD. Safe to run more than once.
// Usage: npm run db:seed
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auth } from "../server/auth.mjs";
import { pool } from "../server/db.mjs";

const email = (process.env.OWNER_EMAIL ?? "").toLowerCase();
const password = process.env.DEV_OWNER_PASSWORD;

try {
  if (process.env.DEV_PASSWORD_LOGIN !== "true" || !email || !password) {
    throw new Error("Set DEV_PASSWORD_LOGIN=true, OWNER_EMAIL and DEV_OWNER_PASSWORD to seed demo data.");
  }

  let { rows } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
  if (!rows[0]) {
    await auth.api.signUpEmail({ body: { email, password, name: process.env.OWNER_DISPLAY_NAME || "Owner" } });
    ({ rows } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [email]));
    console.log("Created owner", email);
  }
  const ownerId = rows[0].id;

  await pool.query(
    `UPDATE owner_settings SET display_name = $2, bio = $3 WHERE owner_id = $1 AND bio = ''`,
    [ownerId, process.env.OWNER_DISPLAY_NAME || "Owner", "Full stack engineer and independent consultant. Let's talk about what you're building."],
  );

  await pool.query(
    `INSERT INTO event_types (owner_id, slug, title, description, duration_min, location_kind, buffer_after_min, min_notice_min, questions, position)
     VALUES ($1, 'project-review', 'Project review', 'A deeper 60-minute session to review your architecture, code or roadmap.', 60, 'google_meet', 15, 1440, $2, 1)
     ON CONFLICT (owner_id, slug) DO NOTHING`,
    [
      ownerId,
      JSON.stringify([
        { id: "company", label: "Company or project", type: "text", required: true },
        { id: "budget", label: "Budget", type: "select", required: false, options: ["Under $5k", "$5k–$20k", "$20k+", "Not sure yet"] },
        { id: "context", label: "What should I look at before the call?", type: "textarea", required: false },
      ]),
    ],
  );

  const { rows: existing } = await pool.query("SELECT count(*)::int AS n FROM bookings WHERE owner_id = $1", [ownerId]);
  if (existing[0].n === 0) {
    const { rows: events } = await pool.query("SELECT id, slug, duration_min, buffer_after_min FROM event_types WHERE owner_id = $1", [ownerId]);
    const bySlug = Object.fromEntries(events.map((e) => [e.slug, e]));
    const day = 86_400_000;
    const at = (days, hourUtc) => {
      const d = new Date(Date.now() + days * day);
      d.setUTCHours(hourUtc, 30, 0, 0);
      return d;
    };
    const samples = [
      { slug: "30min", start: at(1, 5), name: "Ana Lee", email: "ana@example.com", tz: "Europe/London", notes: "Planning a SaaS MVP — need help picking the stack." },
      { slug: "project-review", start: at(2, 8), name: "Rahul Sen", email: "rahul@example.com", tz: "Asia/Kolkata", notes: "", answers: { company: "Sen Logistics", budget: "$5k–$20k" } },
      { slug: "30min", start: at(3, 10), name: "Maya Chen", email: "maya@example.com", tz: "America/New_York", notes: "Chat about a Next.js migration." },
      { slug: "30min", start: at(-2, 6), name: "Tom Becker", email: "tom@example.com", tz: "Europe/Berlin", notes: "" },
      { slug: "30min", start: at(4, 7), name: "Lina Park", email: "lina@example.com", tz: "Asia/Seoul", notes: "", cancelled: "Found another time slot that suits the team better." },
    ];
    for (const s of samples) {
      const ev = bySlug[s.slug];
      const id = randomUUID();
      const end = new Date(s.start.getTime() + ev.duration_min * 60_000);
      await pool.query(
        `INSERT INTO bookings (id, owner_id, event_type_id, start_at, end_at, blocked, status, guest_name, guest_email, guest_time_zone,
                               notes, answers, location_url, manage_token_hash, ics_uid, cancel_reason, cancelled_at)
         VALUES ($1,$2,$3,$4,$5, tstzrange($4::timestamptz, $5::timestamptz + make_interval(mins => $6), '[)'), $7, $8, $9, $10,
                 $11, $12, $13, $14, $15, $16, $17)`,
        [
          id, ownerId, ev.id, s.start.toISOString(), end.toISOString(), ev.buffer_after_min,
          s.cancelled ? "cancelled" : "confirmed", s.name, s.email, s.tz, s.notes, JSON.stringify(s.answers ?? {}),
          "https://meet.google.com/abc-defg-hij",
          createHash("sha256").update(randomBytes(32)).digest("hex"), `${id}@slotwell`,
          s.cancelled ?? null, s.cancelled ? new Date().toISOString() : null,
        ],
      );
    }
    console.log(`Added ${samples.length} sample bookings.`);
  }
  console.log("Seed complete. Sign in at /login with", email);
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
