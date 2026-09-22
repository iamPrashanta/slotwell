import "server-only";

/** Server-side configuration read from the environment. */
export const appConfig = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3004").replace(/\/$/, ""),
  ownerUsername: (process.env.OWNER_USERNAME ?? "").toLowerCase(),
  googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
};
