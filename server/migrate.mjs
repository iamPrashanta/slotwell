// Applies Better Auth's schema, then every SQL file in server/migrations in name order.
// Each SQL file runs once, inside a transaction, and is recorded in schema_migrations.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "./auth.mjs";
import { pool } from "./db.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

try {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  console.log("Better Auth schema is up to date.");

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const { rowCount } = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (rowCount) continue;

    const sql = await readFile(path.join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`${file}: ${error.message}`);
    } finally {
      client.release();
    }
  }
  // Bootstrap admins from ADMIN_EMAILS (promote only; demote from the admin panel).
  const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.OWNER_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length) {
    const { rowCount: promoted } = await pool.query(
      `UPDATE "user" SET role = 'admin' WHERE lower(email) = ANY($1) AND role <> 'admin'`,
      [adminEmails],
    );
    if (promoted) console.log(`Granted admin to ${promoted} account(s) from ADMIN_EMAILS.`);
  }
  console.log("Slotwell migrations completed.");
} catch (error) {
  console.error("Migration failed:", error.code ?? "", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
