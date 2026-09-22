import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { pool } from "./db.mjs";
import { setupOwner } from "./owner-setup.mjs";

/** Google scopes: sign-in + reading busy times + creating events with Meet links. */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events",
];

const ownerEmail = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
const ownerUsername = (process.env.OWNER_USERNAME ?? "").trim().toLowerCase();
const appUrl = process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3004";

/** Local demo sign-in with email + password. Never enable on a public server. */
export const devPasswordLogin = process.env.DEV_PASSWORD_LOGIN === "true";
if (devPasswordLogin && process.env.NODE_ENV === "production" && appUrl.startsWith("https://")) {
  throw new Error("[slotwell] DEV_PASSWORD_LOGIN=true is not allowed on a public https URL. Turn it off.");
}

/** Accounts that become admins automatically (promote only). Falls back to OWNER_EMAIL. */
export const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.OWNER_EMAIL ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** SIGNUPS_OPEN=false closes sign-up to everyone except ADMIN_EMAILS. */
export const signupsOpen = process.env.SIGNUPS_OPEN !== "false";

export const auth = betterAuth({
  appName: "Slotwell",
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: appUrl,
  trustedOrigins: [appUrl],
  // Open sign-up (see SIGNUPS_OPEN). Email/password exists only for local demos (DEV_PASSWORD_LOGIN=true);
  // production signs in with Google, which also connects the calendar.
  emailAndPassword: { enabled: devPasswordLogin, requireEmailVerification: false, minPasswordLength: 8 },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      scope: GOOGLE_CALENDAR_SCOPES,
      // Needed to receive a refresh token so the calendar keeps working without re-login.
      accessType: "offline",
      prompt: "select_account consent",
    },
  },
  account: {
    encryptOAuthTokens: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = String(user.email ?? "").trim().toLowerCase();
          if (!signupsOpen && !adminEmails.includes(email)) {
            throw new APIError("FORBIDDEN", { message: "Sign-ups are closed right now." });
          }
          return { data: { ...user, email } };
        },
        after: async (user) => {
          const email = String(user.email ?? "").toLowerCase();
          if (adminEmails.includes(email)) {
            await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [user.id]);
          }
          // The operator's own account keeps its configured username; everyone else picks one in /onboarding.
          if (ownerEmail && email === ownerEmail && ownerUsername) {
            await setupOwner(user.id, {
              username: ownerUsername,
              displayName: process.env.OWNER_DISPLAY_NAME ?? "",
              timeZone: process.env.OWNER_TIME_ZONE ?? "UTC",
            });
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const { rows } = await pool.query(`SELECT banned FROM "user" WHERE id = $1`, [session.userId]);
          if (rows[0]?.banned) throw new APIError("FORBIDDEN", { message: "This account is suspended." });
          return { data: session };
        },
      },
    },
  },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
  session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
});
