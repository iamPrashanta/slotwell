import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@server/auth.mjs";
import { pool } from "@server/db.mjs";

export type Role = "user" | "admin";

/** Current Better Auth session, or null. Memoised per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Role / ban state straight from the database (never trusted from the cookie). */
export const getAccountState = cache(async (userId: string) => {
  const { rows } = await pool.query<{ role: Role; banned: boolean; onboarded: boolean }>(
    `SELECT u.role, u.banned, (s.owner_id IS NOT NULL) AS onboarded
       FROM "user" u LEFT JOIN owner_settings s ON s.owner_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
});

/** Signed in and not suspended. Use in /onboarding and anything that doesn't need a booking profile. */
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  const state = await getAccountState(session.user.id);
  if (!state || state.banned) {
    await auth.api.signOut({ headers: await headers() }).catch(() => {});
    redirect("/login?error=suspended");
  }
  return { ...session, role: state.role, onboarded: state.onboarded };
});

/** Signed in, not suspended and onboarded. Use in dashboard pages, Server Actions and route handlers. */
export const requireOwner = cache(async () => {
  const session = await requireUser();
  if (!session.onboarded) redirect("/onboarding");
  return session;
});
