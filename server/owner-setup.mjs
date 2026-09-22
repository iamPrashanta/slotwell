// Creates a user's booking profile with sensible defaults. Used by onboarding and the demo seed.
import { pool } from "./db.mjs";

/**
 * Creates owner_settings, default availability (Mon–Fri 10:00–18:00) and a 30-minute meeting type.
 * Safe to run more than once: existing rows are kept.
 * @param {string} userId
 * @param {{ username: string, displayName: string, timeZone: string }} profile
 */
export async function setupOwner(userId, { username, displayName, timeZone }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO owner_settings (owner_id, username, display_name, time_zone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner_id) DO NOTHING`,
      [userId, username.toLowerCase(), displayName, timeZone],
    );
    const { rowCount } = await client.query("SELECT 1 FROM availability_rules WHERE owner_id = $1 LIMIT 1", [userId]);
    if (!rowCount) {
      for (const weekday of [1, 2, 3, 4, 5]) {
        await client.query(
          "INSERT INTO availability_rules (owner_id, weekday, start_time, end_time) VALUES ($1, $2, '10:00', '18:00')",
          [userId, weekday],
        );
      }
    }
    await client.query(
      `INSERT INTO event_types (owner_id, slug, title, description, duration_min, location_kind)
       VALUES ($1, '30min', 'Intro call', 'A 30-minute call to talk through your goals and next steps.', 30, 'google_meet')
       ON CONFLICT (owner_id, slug) DO NOTHING`,
      [userId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
