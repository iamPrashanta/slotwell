import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

// Runs the SQL migrations against an in-memory PostgreSQL (PGlite) and checks the booking rules.
// Usage: npm run test:db
const root = fileURLToPath(new URL("..", import.meta.url));
const db = await PGlite.create({ extensions: { btree_gist } });
// Stand-in for Better Auth's user table.
await db.exec(`CREATE TABLE "user" (id text PRIMARY KEY, name text, email text, image text, "createdAt" timestamptz NOT NULL DEFAULT now());
  CREATE TABLE session (id text PRIMARY KEY, "userId" text REFERENCES "user"(id) ON DELETE CASCADE, "updatedAt" timestamptz NOT NULL DEFAULT now());`);
for (const f of ["001_init.sql", "002_booking_sync.sql", "003_multi_user_admin.sql"]) {
  await db.exec(readFileSync(`${root}/server/migrations/${f}`, "utf8"));
  console.log("applied", f);
}
await db.exec(`INSERT INTO "user" (id, name, email, image) VALUES ('u1','Prashanta','p@example.com',null);
  INSERT INTO owner_settings (owner_id, username, display_name, time_zone) VALUES ('u1','iamprashanta','Prashanta','Asia/Kolkata');
  INSERT INTO event_types (owner_id, slug, title, duration_min) VALUES ('u1','30min','Intro call',30);`);

// Reserved usernames are rejected.
await assert.rejects(db.query(`INSERT INTO owner_settings (owner_id, username) VALUES ('u1','dashboard')`));

const ev = (await db.query("SELECT id FROM event_types")).rows[0].id;
// The exact INSERT used by src/server/bookings.ts
const insert = `INSERT INTO bookings (id, owner_id, event_type_id, start_at, end_at, blocked, guest_name, guest_email,
    guest_time_zone, notes, answers, manage_token_hash, ics_uid, ics_sequence, rescheduled_from_id)
  VALUES ($1, $2, $3, $4, $5,
    tstzrange($4::timestamptz - make_interval(mins => $6), $5::timestamptz + make_interval(mins => $7), '[)'),
    $8, $9, $10, $11, $12, $13, $14, $15, $16)`;
const book = (id, start, end, token, from = null) =>
  db.query(insert, [id, "u1", ev, start, end, 0, 10, "Ana", "ana@example.com", "Europe/London", "", "{}", token, `${id}@slotwell`, 0, from]);

const a = "11111111-1111-1111-1111-111111111111";
await book(a, "2026-09-21T04:30:00Z", "2026-09-21T05:00:00Z", "t1");
console.log("booking A saved");

// Overlap with A's 10-minute after-buffer (05:00–05:10) must fail with 23P01.
await assert.rejects(book("22222222-2222-2222-2222-222222222222", "2026-09-21T05:05:00Z", "2026-09-21T05:35:00Z", "t2"), (e) => e.code === "23P01");
console.log("overlapping booking rejected (23P01)");

// Right after the buffer is fine.
await book("33333333-3333-3333-3333-333333333333", "2026-09-21T05:10:00Z", "2026-09-21T05:40:00Z", "t3");
console.log("adjacent booking after buffer saved");

// Reschedule flow: cancel A then insert at the same time in one transaction.
await db.transaction(async (tx) => {
  await tx.query(`UPDATE bookings SET status='cancelled', cancelled_at=now(), cancel_reason='Rescheduled' WHERE id=$1 AND status='confirmed'`, [a]);
  await tx.query(insert, ["44444444-4444-4444-4444-444444444444", "u1", ev, "2026-09-21T04:30:00Z", "2026-09-21T05:00:00Z", 0, 10, "Ana", "ana@example.com", "UTC", "", "{}", "t4", `${a}@slotwell`, 1, a]);
});
console.log("reschedule into the freed slot saved");

// Owner-scoped exclusion: a second owner can book the same time.
await db.exec(`INSERT INTO "user" VALUES ('u2','Other','o@example.com',null)`);
await db.query(insert, ["55555555-5555-5555-5555-555555555555", "u2", ev, "2026-09-21T04:30:00Z", "2026-09-21T05:00:00Z", 0, 0, "B", "b@example.com", "UTC", "", "{}", "t5", "x@slotwell", 0, null]);
console.log("other owner same time saved");

// getBookedRanges query shape
const r = await db.query(`SELECT lower(blocked) AS b_start, upper(blocked) AS b_end, to_char(start_at AT TIME ZONE $4, 'YYYY-MM-DD') AS local_date
   FROM bookings WHERE owner_id = $1 AND status = 'confirmed' AND blocked && tstzrange($2, $3) AND ($5::uuid IS NULL OR id <> $5::uuid)`,
  ["u1", "2026-09-20T00:00:00Z", "2026-09-22T00:00:00Z", "Asia/Kolkata", null]);
assert.equal(r.rows.length, 2);
assert.equal(r.rows[0].local_date, "2026-09-21");
console.log("availability query ok:", r.rows.length, "confirmed ranges");

// 003: roles, wider reserved usernames, admin 2FA + audit tables.
await assert.rejects(db.query(`INSERT INTO owner_settings (owner_id, username) VALUES ('u1','onboarding')`));
await assert.rejects(db.query(`UPDATE "user" SET role = 'superuser' WHERE id = 'u1'`));
await db.query(`UPDATE "user" SET role = 'admin' WHERE id = 'u1'`);
await db.query(`INSERT INTO admin_totp (user_id, secret_enc) VALUES ('u1', 'x')`);
await db.query(`INSERT INTO admin_audit_log (admin_id, action) VALUES ('u1', 'admin.login')`);
const { rows: roleRows } = await db.query(`SELECT role, banned FROM "user" WHERE id = 'u1'`);
assert.deepEqual(roleRows[0], { role: "admin", banned: false });
console.log("multi-user/admin schema ok");
console.log("ALL DB CHECKS PASSED");
