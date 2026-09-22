"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { pool } from "@server/db.mjs";
import {
  audit,
  checkAdminCode,
  generateBackupCodes,
  replaceBackupCodes,
  requireAdmin,
} from "@/server/admin-auth";
import { BookingError, cancelBookingAsOwner } from "@/server/bookings";
import { rateLimit } from "@/server/rate-limit";

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };

const userId = z.string().min(1).max(100);
const reasonSchema = z.string().trim().max(500);

function fail(error: unknown): AdminResult {
  if (error instanceof BookingError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: "Invalid input." };
  console.error("admin action failed:", error instanceof Error ? error.message : error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function banUser(id: string, reason: string, cancelUpcoming: boolean): Promise<AdminResult> {
  const admin = await requireAdmin();
  try {
    const target = userId.parse(id);
    const why = reasonSchema.parse(reason);
    if (target === admin.user.id) return { ok: false, error: "You can't suspend your own account." };
    const { rowCount } = await pool.query(
      `UPDATE "user" SET banned = true, ban_reason = $2, banned_at = now() WHERE id = $1 AND NOT banned`,
      [target, why || null],
    );
    if (!rowCount) return { ok: false, error: "User not found or already suspended." };
    await pool.query(`DELETE FROM session WHERE "userId" = $1`, [target]);

    let cancelled = 0;
    if (cancelUpcoming) {
      const { rows } = await pool.query(
        "SELECT id FROM bookings WHERE owner_id = $1 AND status = 'confirmed' AND start_at > now()",
        [target],
      );
      for (const row of rows) {
        await cancelBookingAsOwner(target, row.id, "The host is no longer available on Slotwell.").then(
          () => cancelled++,
          (e) => console.error("ban: cancel failed", row.id, e instanceof Error ? e.message : e),
        );
      }
    }
    await audit(admin.user.id, "user.suspended", { type: "user", id: target }, { reason: why, cancelledBookings: cancelled });
    refresh();
    return { ok: true, message: cancelled ? `Suspended. ${cancelled} upcoming booking(s) cancelled.` : "Suspended." };
  } catch (error) {
    return fail(error);
  }
}

export async function unbanUser(id: string): Promise<AdminResult> {
  const admin = await requireAdmin();
  try {
    const target = userId.parse(id);
    const { rowCount } = await pool.query(
      `UPDATE "user" SET banned = false, ban_reason = NULL, banned_at = NULL WHERE id = $1 AND banned`,
      [target],
    );
    if (!rowCount) return { ok: false, error: "User not found or not suspended." };
    await audit(admin.user.id, "user.unsuspended", { type: "user", id: target });
    refresh();
    return { ok: true, message: "Suspension lifted." };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeSessions(id: string): Promise<AdminResult> {
  const admin = await requireAdmin();
  try {
    const target = userId.parse(id);
    if (target === admin.user.id) return { ok: false, error: "Use sign out for your own sessions." };
    const { rowCount } = await pool.query(`DELETE FROM session WHERE "userId" = $1`, [target]);
    await audit(admin.user.id, "user.sessions_revoked", { type: "user", id: target }, { count: rowCount });
    refresh();
    return { ok: true, message: `${rowCount ?? 0} session(s) signed out.` };
  } catch (error) {
    return fail(error);
  }
}

export async function setUserRole(id: string, role: "user" | "admin"): Promise<AdminResult> {
  const admin = await requireAdmin();
  try {
    const target = userId.parse(id);
    const next = z.enum(["user", "admin"]).parse(role);
    if (target === admin.user.id) return { ok: false, error: "You can't change your own role." };
    const { rowCount } = await pool.query(`UPDATE "user" SET role = $2 WHERE id = $1 AND role <> $2 AND NOT banned`, [target, next]);
    if (!rowCount) return { ok: false, error: "No change (user not found, suspended or already has that role)." };
    if (next === "user") await pool.query("DELETE FROM admin_totp WHERE user_id = $1", [target]);
    await audit(admin.user.id, next === "admin" ? "user.admin_granted" : "user.admin_removed", { type: "user", id: target });
    refresh();
    return { ok: true, message: next === "admin" ? "Admin access granted. They'll set up 2FA on first admin sign-in." : "Admin access removed." };
  } catch (error) {
    return fail(error);
  }
}

export async function adminCancelBooking(id: string, reason: string): Promise<AdminResult> {
  const admin = await requireAdmin();
  try {
    const bookingId = z.uuid().parse(id);
    const why = reasonSchema.parse(reason);
    const { rows } = await pool.query("SELECT owner_id FROM bookings WHERE id = $1", [bookingId]);
    if (!rows[0]) return { ok: false, error: "Booking not found." };
    await cancelBookingAsOwner(rows[0].owner_id, bookingId, why);
    await audit(admin.user.id, "booking.cancelled", { type: "booking", id: bookingId }, { reason: why, host: rows[0].owner_id });
    refresh();
    return { ok: true, message: "Booking cancelled and guest notified." };
  } catch (error) {
    return fail(error);
  }
}

export async function regenerateBackupCodes(code: string): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if (!rateLimit(`admin2fa:regen:${admin.user.id}`, 5, 10 * 60_000).ok) {
    return { ok: false, error: "Too many attempts. Wait 10 minutes and try again." };
  }
  if (!(await checkAdminCode(admin.user.id, String(code).slice(0, 20)))) {
    await audit(admin.user.id, "admin.backup_codes_failed");
    return { ok: false, error: "That code isn't valid." };
  }
  const { plain, hashed } = generateBackupCodes();
  await replaceBackupCodes(admin.user.id, hashed);
  await audit(admin.user.id, "admin.backup_codes_regenerated");
  return { ok: true, codes: plain };
}
