import { z } from "zod";

/** Must match the CHECK constraint in server/migrations/003_multi_user_admin.sql. */
export const RESERVED_USERNAMES = new Set([
  "api", "login", "logout", "signup", "register", "dashboard", "embed", "booking", "bookings", "admin",
  "onboarding", "settings", "account", "pricing", "billing", "help", "support", "about", "terms", "privacy",
  "blog", "docs", "status", "www", "app", "static", "assets", "slotwell", "root", "system",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,38}$/, "Username: 2–39 lowercase letters, numbers or dashes")
  .refine((v) => !RESERVED_USERNAMES.has(v), "That username is reserved");

/** A readable username suggestion from an email or name. */
export function suggestUsername(source: string): string {
  const base = source.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  const candidate = base.length >= 2 ? base : `user-${base}`.replace(/-$/, "");
  return RESERVED_USERNAMES.has(candidate) ? `${candidate}-1` : candidate;
}
