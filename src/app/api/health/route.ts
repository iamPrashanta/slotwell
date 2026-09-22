import { NextResponse } from "next/server";
import { pool } from "@server/db.mjs";

/** Used by the deploy check: 200 when the app and database respond. */
export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "database_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
