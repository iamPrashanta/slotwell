import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ExternalLink, Monitor } from "lucide-react";
import { Avatar, Badge, Empty, Panel, StatTile, formatDate, formatDateTime, timeAgo } from "@/components/admin/ui";
import { UserActions } from "@/components/admin/user-actions";
import { requireAdmin } from "@/server/admin-auth";
import { getUserDetail } from "@/server/admin-data";
import { adminTimeZone, requestNow } from "@/server/admin-prefs";

export const metadata: Metadata = { title: "User" };

function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /node|undici|curl/i.test(ua) ? "Script" : "Browser";
  return [browser, os].filter(Boolean).join(" on ");
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  await connection();
  const { id } = await params;
  if (id.length > 100) notFound();
  const [u, tz] = await Promise.all([getUserDetail(id), adminTimeZone(session.user.id)]);
  if (!u) notFound();
  const now = requestNow();
  const isSelf = u.id === session.user.id;

  return (
    <>
      <Link href="/admin/users" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All users
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <Avatar name={u.name || u.email} image={u.image} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{u.name || u.email}</h1>
          <p className="truncate text-sm text-muted">{u.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {u.banned ? <Badge tone="bad">Suspended</Badge> : <Badge tone="good">Active</Badge>}
            {u.role === "admin" && <Badge tone="warn">Admin{u.twoFactor ? " · 2FA on" : " · 2FA not set up"}</Badge>}
            {u.google ? <Badge tone="accent">Google connected</Badge> : <Badge>No Google</Badge>}
            {!u.profile && <Badge>Not onboarded</Badge>}
            {isSelf && <Badge>You</Badge>}
          </div>
        </div>
        {u.profile && (
          <a href={`/${u.profile.username}`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm hover:border-accent/60">
            <ExternalLink className="h-4 w-4" aria-hidden /> /{u.profile.username}
          </a>
        )}
      </div>

      {u.banned && (
        <p className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Suspended {formatDateTime(u.bannedAt, tz, { withYear: true })}{u.banReason ? ` — “${u.banReason}”` : ""}. Their booking pages show “not found”.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Bookings" value={u.stats.total} />
        <StatTile label="Upcoming" value={u.stats.upcoming} />
        <StatTile label="Cancelled" value={u.stats.cancelled} />
        <StatTile label="Last 30 days" value={u.stats.last30} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Recent bookings">
            {u.bookings.length === 0 ? <Empty>No bookings yet.</Empty> : (
              <ul className="divide-y divide-border">
                {u.bookings.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-2 py-2.5 text-sm">
                    <span className="w-28 shrink-0 text-xs text-muted">{formatDateTime(b.start, tz)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{b.guestName}</span>
                      <span className="block truncate text-xs text-muted">{b.eventTitle} · {b.guestEmail}</span>
                    </span>
                    {b.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge> : b.syncError ? <Badge tone="warn">Sync error</Badge> : new Date(b.end).getTime() > now ? <Badge tone="good">Upcoming</Badge> : <Badge>Done</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Meeting types">
            {u.eventTypes.length === 0 ? <Empty>None.</Empty> : (
              <ul className="divide-y divide-border">
                {u.eventTypes.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-2 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.title}</span>
                      <span className="block truncate text-xs text-muted">/{u.profile?.username}/{e.slug} · {e.durationMin} min</span>
                    </span>
                    <span className="text-xs tabular-nums text-muted">{e.bookings} bookings</span>
                    {e.isActive ? <Badge tone="good">On</Badge> : <Badge>Off</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Actions">
            <UserActions user={{ id: u.id, name: u.name || u.email, banned: u.banned, role: u.role, upcoming: u.stats.upcoming }} isSelf={isSelf} />
          </Panel>

          <Panel title="Profile">
            <dl className="grid gap-2.5 px-2 py-1 text-sm">
              {[
                ["Joined", formatDate(u.createdAt, tz)],
                ["Email verified", u.emailVerified ? "Yes" : "No"],
                ["Username", u.profile ? `/${u.profile.username}` : "—"],
                ["Display name", u.profile?.displayName || "—"],
                ["Time zone", u.profile?.timeZone.replaceAll("_", " ") ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="truncate text-right">{v}</dd></div>
              ))}
            </dl>
          </Panel>

          <Panel title={`Active sessions (${u.sessions.length})`}>
            {u.sessions.length === 0 ? <Empty>Signed out everywhere.</Empty> : (
              <ul className="divide-y divide-border">
                {u.sessions.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-2 py-2.5 text-sm">
                    <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate">{device(s.userAgent)}</span>
                      <span className="block truncate text-xs text-muted">{s.ip ?? "IP unknown"} · active {timeAgo(s.lastSeen, now)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
