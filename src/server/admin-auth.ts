import "server-only";

import { cache } from "react";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { pool } from "@server/db.mjs";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { appConfig } from "./config";
import { clientIp } from "./rate-limit";
import { getAccountState, getSession } from "./session";

/**
 * Admin step-up auth. An admin needs (1) a normal session, (2) role = 'admin' in the database and
 * (3) a TOTP-verified, HMAC-signed `sw_admin` cookie bound to that session. See docs/ADMIN.md.
 */
export const ADMIN_COOKIE = "sw_admin";
const ADMIN_TTL_MS = 8 * 60 * 60 * 1000;

function deriveKey(purpose: string): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be set (32+ chars) for admin auth.");
  return Buffer.from(hkdfSync("sha256", secret, "slotwell-admin", purpose, 32));
}

// ---------- Encryption of the TOTP secret (AES-256-GCM) ----------

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("totp-secret"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", deriveKey("totp-secret"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ---------- Backup codes ----------

const normalizeBackup = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");
const hashBackup = (code: string) => createHmac("sha256", deriveKey("backup-codes")).update(normalizeBackup(code)).digest("hex");

export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const plain = Array.from({ length: 10 }, () => {
    const bytes = randomBytes(8);
    const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
  return { plain, hashed: plain.map(hashBackup) };
}

// ---------- Signed admin cookie ----------

function sign(sessionId: string, userId: string, exp: number): string {
  return createHmac("sha256", deriveKey("admin-cookie")).update(`${sessionId}.${userId}.${exp}`).digest("base64url");
}

export async function setAdminCookie(sessionId: string, userId: string) {
  const exp = Date.now() + ADMIN_TTL_MS;
  (await cookies()).set(ADMIN_COOKIE, `${exp}.${sign(sessionId, userId, exp)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: appConfig.appUrl.startsWith("https://"),
    path: "/",
    maxAge: ADMIN_TTL_MS / 1000,
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

async function hasValidAdminCookie(sessionId: string, userId: string): Promise<boolean> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  const [expRaw, sig] = value.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  const expected = Buffer.from(sign(sessionId, userId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ---------- TOTP rows ----------

type TotpRow = { secret_enc: string; confirmed_at: Date | null; last_step: string; backup_codes: string[] };

async function getTotpRow(userId: string): Promise<TotpRow | null> {
  const { rows } = await pool.query<TotpRow>("SELECT secret_enc, confirmed_at, last_step, backup_codes FROM admin_totp WHERE user_id = $1", [userId]);
  return rows[0] ?? null;
}

/** Returns the pending (unconfirmed) secret, creating one if needed. */
async function pendingSecret(userId: string): Promise<string> {
  const row = await getTotpRow(userId);
  if (row && !row.confirmed_at) return decrypt(row.secret_enc);
  const secret = generateTotpSecret();
  await pool.query(
    `INSERT INTO admin_totp (user_id, secret_enc) VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, encrypt(secret)],
  );
  // A concurrent request may have inserted first — always return what is stored.
  const stored = await getTotpRow(userId);
  return decrypt(stored!.secret_enc);
}

/**
 * Checks a 6-digit TOTP or a backup code. On success stores the used step / burns the backup code.
 * `confirm` is used during setup (accepts only TOTP against the pending secret).
 */
export async function checkAdminCode(userId: string, code: string, opts: { confirm?: boolean } = {}): Promise<boolean> {
  const row = await getTotpRow(userId);
  if (!row) return false;
  if (!opts.confirm && !row.confirmed_at) return false;

  const step = verifyTotp(decrypt(row.secret_enc), code, { lastStep: Number(row.last_step) });
  if (step !== null) {
    // Conditional update makes replay-protection race-safe.
    const { rowCount } = await pool.query(
      "UPDATE admin_totp SET last_step = $2, updated_at = now() WHERE user_id = $1 AND last_step < $2",
      [userId, step],
    );
    return rowCount === 1;
  }
  if (opts.confirm) return false;

  const hashed = hashBackup(code);
  if (normalizeBackup(code).length !== 8 || !row.backup_codes.includes(hashed)) return false;
  const { rowCount } = await pool.query(
    "UPDATE admin_totp SET backup_codes = array_remove(backup_codes, $2), updated_at = now() WHERE user_id = $1 AND $2 = ANY(backup_codes)",
    [userId, hashed],
  );
  return rowCount === 1;
}

export async function confirmTotp(userId: string, hashedBackupCodes: string[]) {
  await pool.query(
    "UPDATE admin_totp SET confirmed_at = now(), backup_codes = $2, updated_at = now() WHERE user_id = $1",
    [userId, hashedBackupCodes],
  );
}

export async function replaceBackupCodes(userId: string, hashed: string[]) {
  await pool.query("UPDATE admin_totp SET backup_codes = $2, updated_at = now() WHERE user_id = $1", [userId, hashed]);
}

export async function backupCodesLeft(userId: string): Promise<number> {
  const row = await getTotpRow(userId);
  return row?.backup_codes.length ?? 0;
}

// ---------- Gates ----------

export type AdminGate =
  | { stage: "signin" }
  | { stage: "forbidden"; email: string }
  | { stage: "setup"; email: string; secret: string; qrSvg: string }
  | { stage: "verify"; email: string }
  | { stage: "ok" };

/** Which step of /admin/login the current visitor is on. */
export async function getAdminGate(): Promise<AdminGate> {
  const session = await getSession();
  if (!session) return { stage: "signin" };
  const state = await getAccountState(session.user.id);
  const email = session.user.email;
  if (!state || state.banned || state.role !== "admin") return { stage: "forbidden", email };
  if (await hasValidAdminCookie(session.session.id, session.user.id)) return { stage: "ok" };

  const row = await getTotpRow(session.user.id);
  if (row?.confirmed_at) return { stage: "verify", email };

  const secret = await pendingSecret(session.user.id);
  const qrSvg = await QRCode.toString(otpauthUri(secret, email), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { stage: "setup", email, secret, qrSvg };
}

/** Session + admin role (no 2FA cookie yet). For the 2FA actions on /admin/login. */
export async function requireAdminIdentity() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const state = await getAccountState(session.user.id);
  if (!state || state.banned || state.role !== "admin") redirect("/admin/login");
  return session;
}

/** Full admin access: role + valid 2FA cookie. Call in EVERY admin page and Server Action. */
export const requireAdmin = cache(async () => {
  const session = await requireAdminIdentity();
  if (!(await hasValidAdminCookie(session.session.id, session.user.id))) redirect("/admin/login");
  return session;
});

// ---------- Audit ----------

export async function audit(
  adminId: string | null,
  action: string,
  target?: { type: string; id: string } | null,
  details: Record<string, unknown> = {},
) {
  const ip = clientIp(await headers());
  await pool
    .query(
      "INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip) VALUES ($1, $2, $3, $4, $5, $6)",
      [adminId, action, target?.type ?? null, target?.id ?? null, JSON.stringify(details), ip === "unknown" ? null : ip],
    )
    .catch((error) => console.error("audit log failed:", error instanceof Error ? error.message : error));
}
