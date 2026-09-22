import "server-only";

import { pool } from "@server/db.mjs";

/** Admin sees times in their own profile time zone (UTC if they haven't onboarded). */
export async function adminTimeZone(userId: string): Promise<string> {
  const { rows } = await pool.query("SELECT time_zone FROM owner_settings WHERE owner_id = $1", [userId]);
  return rows[0]?.time_zone ?? "UTC";
}


export { requestNow } from "./clock";
