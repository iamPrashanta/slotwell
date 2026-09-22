import "server-only";

import { pool } from "@server/db.mjs";

/** Read-only queries for the admin panel. Every caller must have passed requireAdmin(). */

export const PAGE_SIZE = 25;
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

// ---------- Overview ----------

export async function getOverview() {
  const t0 = performance.now();
  const [users, bookings, series, recentUsers, recentBookings, topHosts, migrations] = await Promise.all([
    pool.query(`
      SELECT count(*)::int                                                     AS total,
             count(*) FILTER (WHERE "createdAt" > now() - interval '7 days')::int  AS new7,
             count(*) FILTER (WHERE "createdAt" > now() - interval '30 days')::int AS new30,
             count(*) FILTER (WHERE banned)::int                               AS banned,
             count(*) FILTER (WHERE role = 'admin')::int                       AS admins,
             (SELECT count(DISTINCT "userId")::int FROM session WHERE "updatedAt" > now() - interval '30 days') AS active30,
             (SELECT count(*)::int FROM "user" u WHERE NOT EXISTS (SELECT 1 FROM owner_settings s WHERE s.owner_id = u.id)) AS not_onboarded
        FROM "user"`),
    pool.query(`
      SELECT count(*)::int                                                                         AS total,
             count(*) FILTER (WHERE status = 'confirmed' AND end_at > now())::int                  AS upcoming,
             count(*) FILTER (WHERE status = 'confirmed' AND start_at BETWEEN now() AND now() + interval '7 days')::int AS next7,
             count(*) FILTER (WHERE created_at > now() - interval '30 days')::int                  AS created30,
             count(*) FILTER (WHERE created_at > now() - interval '30 days' AND status = 'cancelled'
                              AND coalesce(cancel_reason, '') <> 'Rescheduled')::int              AS cancelled30,
             count(*) FILTER (WHERE status = 'confirmed' AND end_at > now() AND sync_error IS NOT NULL)::int AS sync_errors
        FROM bookings`),
    pool.query(`
      SELECT d::date AS day,
             (SELECT count(*)::int FROM "user" WHERE "createdAt" >= d AND "createdAt" < d + interval '1 day') AS signups,
             (SELECT count(*)::int FROM bookings WHERE created_at >= d AND created_at < d + interval '1 day')  AS bookings
        FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
       ORDER BY d`),
    pool.query(`
      SELECT u.id, u.name, u.email, u.image, u."createdAt" AS created_at, s.username
        FROM "user" u LEFT JOIN owner_settings s ON s.owner_id = u.id
       ORDER BY u."createdAt" DESC LIMIT 6`),
    pool.query(`
      SELECT b.id, b.start_at, b.status, b.guest_name, b.created_at, e.title, s.username, u.id AS host_id, u.name AS host_name
        FROM bookings b JOIN event_types e ON e.id = b.event_type_id
        JOIN "user" u ON u.id = b.owner_id LEFT JOIN owner_settings s ON s.owner_id = b.owner_id
       ORDER BY b.created_at DESC LIMIT 8`),
    pool.query(`
      SELECT u.id, u.name, u.email, s.username, count(b.id)::int AS bookings
        FROM bookings b JOIN "user" u ON u.id = b.owner_id LEFT JOIN owner_settings s ON s.owner_id = u.id
       WHERE b.created_at > now() - interval '30 days'
       GROUP BY u.id, s.username ORDER BY bookings DESC LIMIT 5`),
    pool.query(`SELECT count(*)::int AS n, max(applied_at) AS last FROM schema_migrations`),
  ]);
  const dbMs = Math.round(performance.now() - t0);
  const b = bookings.rows[0];
  return {
    users: users.rows[0] as { total: number; new7: number; new30: number; banned: number; admins: number; active30: number; not_onboarded: number },
    bookings: { ...b, cancelRate: b.created30 ? Math.round((b.cancelled30 / b.created30) * 100) : 0 } as {
      total: number; upcoming: number; next7: number; created30: number; cancelled30: number; sync_errors: number; cancelRate: number;
    },
    series: series.rows.map((r) => ({ day: new Date(r.day).toISOString().slice(0, 10), signups: r.signups as number, bookings: r.bookings as number })),
    recentUsers: recentUsers.rows.map((r) => ({ id: r.id, name: r.name, email: r.email, image: r.image, username: r.username, createdAt: iso(r.created_at)! })),
    recentBookings: recentBookings.rows.map((r) => ({
      id: r.id, start: iso(r.start_at)!, status: r.status as string, guestName: r.guest_name, createdAt: iso(r.created_at)!,
      eventTitle: r.title, hostId: r.host_id, hostName: r.host_name, username: r.username,
    })),
    topHosts: topHosts.rows.map((r) => ({ id: r.id, name: r.name, email: r.email, username: r.username, bookings: r.bookings as number })),
    system: {
      dbMs,
      migrations: migrations.rows[0].n as number,
      lastMigration: iso(migrations.rows[0].last),
      calendar: process.env.CALENDAR_PROVIDER === "none" ? "Off (demo)" : "Google",
      smtp: process.env.SMTP_HOST ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? 587}` : "Not configured",
      signupsOpen: process.env.SIGNUPS_OPEN !== "false",
      devPasswordLogin: process.env.DEV_PASSWORD_LOGIN === "true",
      node: process.version,
    },
  };
}

// ---------- Users ----------

export type UserFilter = "all" | "active" | "banned" | "admins" | "not_onboarded";
export type UserSort = "newest" | "oldest" | "bookings" | "last_seen";

export async function listUsers({ q = "", filter = "all", sort = "newest", page = 1 }: { q?: string; filter?: UserFilter; sort?: UserSort; page?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.trim()) {
    params.push(`%${q.trim().toLowerCase().replace(/[%_\\]/g, "\\$&")}%`);
    where.push(`(lower(u.email) LIKE $${params.length} OR lower(u.name) LIKE $${params.length} OR s.username LIKE $${params.length})`);
  }
  if (filter === "active") where.push("NOT u.banned");
  if (filter === "banned") where.push("u.banned");
  if (filter === "admins") where.push("u.role = 'admin'");
  if (filter === "not_onboarded") where.push("s.owner_id IS NULL");
  const order = {
    newest: `u."createdAt" DESC`,
    oldest: `u."createdAt" ASC`,
    bookings: `bookings DESC, u."createdAt" DESC`,
    last_seen: `last_seen DESC NULLS LAST`,
  }[sort];
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(PAGE_SIZE, (Math.max(1, page) - 1) * PAGE_SIZE);
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.image, u.role, u.banned, u."createdAt" AS created_at, s.username,
            (SELECT count(*)::int FROM bookings b WHERE b.owner_id = u.id) AS bookings,
            (SELECT count(*)::int FROM event_types e WHERE e.owner_id = u.id) AS event_types,
            (SELECT max("updatedAt") FROM session x WHERE x."userId" = u.id) AS last_seen,
            EXISTS (SELECT 1 FROM account a WHERE a."userId" = u.id AND a."providerId" = 'google') AS google,
            count(*) OVER()::int AS total
       FROM "user" u LEFT JOIN owner_settings s ON s.owner_id = u.id
       ${whereSql}
      ORDER BY ${order}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    total: (rows[0]?.total as number) ?? 0,
    users: rows.map((r) => ({
      id: r.id as string, name: r.name as string, email: r.email as string, image: r.image as string | null,
      role: r.role as "user" | "admin", banned: r.banned as boolean, username: r.username as string | null,
      bookings: r.bookings as number, eventTypes: r.event_types as number, google: r.google as boolean,
      createdAt: iso(r.created_at)!, lastSeen: iso(r.last_seen),
    })),
  };
}

export async function getUserDetail(id: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.image, u.role, u.banned, u.ban_reason, u.banned_at, u."createdAt" AS created_at,
            u."emailVerified" AS email_verified, s.username, s.display_name, s.time_zone, s.bio,
            EXISTS (SELECT 1 FROM account a WHERE a."userId" = u.id AND a."providerId" = 'google') AS google,
            EXISTS (SELECT 1 FROM admin_totp t WHERE t.user_id = u.id AND t.confirmed_at IS NOT NULL) AS two_factor
       FROM "user" u LEFT JOIN owner_settings s ON s.owner_id = u.id WHERE u.id = $1`,
    [id],
  );
  const u = rows[0];
  if (!u) return null;
  const [events, stats, bookings, sessions] = await Promise.all([
    pool.query(
      `SELECT id, title, slug, duration_min, is_active,
              (SELECT count(*)::int FROM bookings b WHERE b.event_type_id = e.id) AS bookings
         FROM event_types e WHERE owner_id = $1 ORDER BY position, created_at`,
      [id],
    ),
    pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'confirmed' AND end_at > now())::int AS upcoming,
              count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
              count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS last30
         FROM bookings WHERE owner_id = $1`,
      [id],
    ),
    pool.query(
      `SELECT b.id, b.start_at, b.end_at, b.status, b.guest_name, b.guest_email, b.sync_error, e.title
         FROM bookings b JOIN event_types e ON e.id = b.event_type_id
        WHERE b.owner_id = $1 ORDER BY b.start_at DESC LIMIT 25`,
      [id],
    ),
    pool.query(
      `SELECT id, "createdAt" AS created_at, "updatedAt" AS updated_at, "expiresAt" AS expires_at, "ipAddress" AS ip, "userAgent" AS ua
         FROM session WHERE "userId" = $1 AND "expiresAt" > now() ORDER BY "updatedAt" DESC LIMIT 10`,
      [id],
    ),
  ]);
  return {
    id: u.id as string, name: u.name as string, email: u.email as string, image: u.image as string | null,
    role: u.role as "user" | "admin", banned: u.banned as boolean, banReason: u.ban_reason as string | null, bannedAt: iso(u.banned_at),
    createdAt: iso(u.created_at)!, emailVerified: u.email_verified as boolean, google: u.google as boolean, twoFactor: u.two_factor as boolean,
    profile: u.username ? { username: u.username as string, displayName: u.display_name as string, timeZone: u.time_zone as string, bio: u.bio as string } : null,
    eventTypes: events.rows.map((e) => ({ id: e.id, title: e.title, slug: e.slug, durationMin: e.duration_min, isActive: e.is_active, bookings: e.bookings as number })),
    stats: stats.rows[0] as { total: number; upcoming: number; cancelled: number; last30: number },
    bookings: bookings.rows.map((b) => ({
      id: b.id as string, start: iso(b.start_at)!, end: iso(b.end_at)!, status: b.status as string, guestName: b.guest_name as string,
      guestEmail: b.guest_email as string, syncError: b.sync_error as string | null, eventTitle: b.title as string,
    })),
    sessions: sessions.rows.map((s) => ({
      id: s.id as string, createdAt: iso(s.created_at)!, lastSeen: iso(s.updated_at)!, expiresAt: iso(s.expires_at)!,
      ip: s.ip as string | null, userAgent: s.ua as string | null,
    })),
  };
}

// ---------- Bookings ----------

export type BookingStatusFilter = "all" | "confirmed" | "cancelled";
export type BookingWhen = "all" | "upcoming" | "past";

export async function listAllBookings({
  q = "", status = "all", when = "all", syncErrors = false, page = 1,
}: { q?: string; status?: BookingStatusFilter; when?: BookingWhen; syncErrors?: boolean; page?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.trim()) {
    params.push(`%${q.trim().toLowerCase().replace(/[%_\\]/g, "\\$&")}%`);
    const n = params.length;
    where.push(`(lower(b.guest_name) LIKE $${n} OR lower(b.guest_email) LIKE $${n} OR lower(u.email) LIKE $${n} OR s.username LIKE $${n} OR lower(e.title) LIKE $${n})`);
  }
  if (status !== "all") where.push(status === "confirmed" ? "b.status = 'confirmed'" : "b.status = 'cancelled'");
  if (when === "upcoming") where.push("b.end_at > now()");
  if (when === "past") where.push("b.end_at <= now()");
  if (syncErrors) where.push("b.sync_error IS NOT NULL AND b.status = 'confirmed'");
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order = when === "upcoming" ? "b.start_at ASC" : "b.start_at DESC";
  params.push(PAGE_SIZE, (Math.max(1, page) - 1) * PAGE_SIZE);
  const { rows } = await pool.query(
    `SELECT b.id, b.start_at, b.end_at, b.status, b.guest_name, b.guest_email, b.guest_time_zone, b.sync_error,
            b.cancel_reason, b.created_at, e.title, e.duration_min, u.id AS host_id, u.name AS host_name, u.email AS host_email,
            s.username, s.time_zone AS host_time_zone, count(*) OVER()::int AS total
       FROM bookings b JOIN event_types e ON e.id = b.event_type_id
       JOIN "user" u ON u.id = b.owner_id LEFT JOIN owner_settings s ON s.owner_id = b.owner_id
       ${whereSql}
      ORDER BY ${order}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    total: (rows[0]?.total as number) ?? 0,
    bookings: rows.map((r) => ({
      id: r.id as string, start: iso(r.start_at)!, end: iso(r.end_at)!, status: r.status as "confirmed" | "cancelled",
      guestName: r.guest_name as string, guestEmail: r.guest_email as string, guestTimeZone: r.guest_time_zone as string,
      syncError: r.sync_error as string | null, cancelReason: r.cancel_reason as string | null, createdAt: iso(r.created_at)!,
      eventTitle: r.title as string, durationMin: r.duration_min as number,
      hostId: r.host_id as string, hostName: r.host_name as string, hostEmail: r.host_email as string,
      username: r.username as string | null, hostTimeZone: (r.host_time_zone as string) ?? "UTC",
      isUpcoming: r.status === "confirmed" && new Date(r.end_at).getTime() > Date.now(),
    })),
  };
}

// ---------- Audit ----------

export async function listAudit(page = 1) {
  const { rows } = await pool.query(
    `SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.ip, l.created_at, u.email AS admin_email,
            count(*) OVER()::int AS total
       FROM admin_audit_log l LEFT JOIN "user" u ON u.id = l.admin_id
      ORDER BY l.created_at DESC LIMIT $1 OFFSET $2`,
    [PAGE_SIZE, (Math.max(1, page) - 1) * PAGE_SIZE],
  );
  return {
    total: (rows[0]?.total as number) ?? 0,
    entries: rows.map((r) => ({
      id: String(r.id), action: r.action as string, targetType: r.target_type as string | null, targetId: r.target_id as string | null,
      details: r.details as Record<string, unknown>, ip: r.ip as string | null, createdAt: iso(r.created_at)!, adminEmail: r.admin_email as string | null,
    })),
  };
}
