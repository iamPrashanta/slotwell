"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  audit,
  checkAdminCode,
  clearAdminCookie,
  confirmTotp,
  generateBackupCodes,
  requireAdminIdentity,
  setAdminCookie,
} from "@/server/admin-auth";
import { clientIp, isRateLimited, rateLimit } from "@/server/rate-limit";

type Result = { ok: false; error: string };

// Failed codes only: 5 per account and 20 per IP in 10 minutes.
const WINDOW = 10 * 60_000;
const keys = async (userId: string) => [`admin2fa:u:${userId}`, `admin2fa:ip:${clientIp(await headers())}`] as const;

async function limited(userId: string): Promise<boolean> {
  const [byUser, byIp] = await keys(userId);
  return isRateLimited(byUser, 5) || isRateLimited(byIp, 20);
}

async function recordFailure(userId: string) {
  const [byUser, byIp] = await keys(userId);
  rateLimit(byUser, 5, WINDOW);
  rateLimit(byIp, 20, WINDOW);
}

/** First-time setup: confirm the authenticator app, then show backup codes once. */
export async function confirmAdminSetup(code: string): Promise<Result | { ok: true; backupCodes: string[] }> {
  const session = await requireAdminIdentity();
  if (await limited(session.user.id)) return { ok: false, error: "Too many attempts. Wait 10 minutes and try again." };
  if (!(await checkAdminCode(session.user.id, String(code), { confirm: true }))) {
    await recordFailure(session.user.id);
    await audit(session.user.id, "admin.2fa_setup_failed");
    return { ok: false, error: "That code didn't match. Check the time on your phone and try again." };
  }
  const { plain, hashed } = generateBackupCodes();
  await confirmTotp(session.user.id, hashed);
  await setAdminCookie(session.session.id, session.user.id);
  await audit(session.user.id, "admin.2fa_enabled");
  return { ok: true, backupCodes: plain };
}

/** Every admin sign-in: 6-digit code or a one-time backup code. */
export async function verifyAdminLogin(code: string): Promise<Result> {
  const session = await requireAdminIdentity();
  if (await limited(session.user.id)) {
    await audit(session.user.id, "admin.login_rate_limited");
    return { ok: false, error: "Too many attempts. Wait 10 minutes and try again." };
  }
  if (!(await checkAdminCode(session.user.id, String(code).slice(0, 20)))) {
    await recordFailure(session.user.id);
    await audit(session.user.id, "admin.login_failed");
    return { ok: false, error: "That code isn't valid." };
  }
  await setAdminCookie(session.session.id, session.user.id);
  await audit(session.user.id, "admin.login");
  redirect("/admin");
}

/** Ends the admin step-up only; the normal session stays signed in. */
export async function lockAdmin() {
  await clearAdminCookie();
  redirect("/admin/login");
}
