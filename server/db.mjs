import pg from "pg";

/** One shared connection pool per process (reused across hot reloads in development). */
const globalForPool = globalThis;

/** @type {import("pg").Pool} */
export const pool =
  globalForPool.slotwellPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

if (process.env.NODE_ENV !== "production") globalForPool.slotwellPool = pool;
