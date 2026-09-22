import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Avatar, Badge, DailyBars, Empty, Panel, StatTile, formatDateTime, timeAgo } from "@/components/admin/ui";
import { requireAdmin } from "@/server/admin-auth";
import { getOverview } from "@/server/admin-data";
import { adminTimeZone, requestNow } from "@/server/admin-prefs";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const session = await requireAdmin();
  await connection();
  const [o, tz] = await Promise.all([getOverview(), adminTimeZone(session.user.id)]);
  const now = requestNow();
  const viewAll = (href: string) => (
    <Link href={href} className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">View all <ArrowRight className="h-3 w-3" aria-hidden /></Link>
  );

  return (
    <>
      <PageHeader title="Overview" description={`Everything happening on Slotwell · times in ${tz.replaceAll("_", " ")}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Users" value={o.users.total} hint={`+${o.users.new7} this week · +${o.users.new30} in 30 days`} />
        <StatTile label="Active users (30d)" value={o.users.active30} hint={`${o.users.not_onboarded} not onboarded · ${o.users.banned} suspended`} />
        <StatTile label="Bookings" value={o.bookings.total} hint={`${o.bookings.created30} created in 30 days`} />
        <StatTile label="Upcoming" value={o.bookings.upcoming} hint={`${o.bookings.next7} in the next 7 days`} />
        <StatTile label="Cancel rate (30d)" value={`${o.bookings.cancelRate}%`} tone={o.bookings.cancelRate > 25 ? "warn" : undefined} hint={`${o.bookings.cancelled30} cancelled`} />
        <StatTile label="Calendar sync errors" value={o.bookings.sync_errors} tone={o.bookings.sync_errors ? "bad" : undefined} hint="Upcoming bookings not in Google" />
        <StatTile label="Admins" value={o.users.admins} />
        <StatTile label="Database" value={`${o.system.dbMs} ms`} tone={o.system.dbMs > 500 ? "warn" : undefined} hint={`${o.system.migrations} migrations applied`} />
      </div>

      {o.bookings.sync_errors > 0 && (
        <Link href="/admin/bookings?sync=1&when=upcoming" className="mt-4 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger hover:border-danger/60">
          <CircleAlert className="h-4 w-4" aria-hidden /> {o.bookings.sync_errors} upcoming booking(s) failed to sync to Google Calendar — review
        </Link>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Last 30 days" className="lg:col-span-2"><div className="py-2"><DailyBars data={o.series} /></div></Panel>
        <Panel title="System">
          <dl className="grid gap-2.5 px-2 py-1 text-sm">
            {[
              ["Sign-ups", o.system.signupsOpen ? <Badge tone="good">Open</Badge> : <Badge tone="warn">Closed</Badge>],
              ["Calendar", o.system.calendar],
              ["Email (SMTP)", o.system.smtp],
              ["Demo password login", o.system.devPasswordLogin ? <Badge tone="warn">On</Badge> : <Badge tone="good">Off</Badge>],
              ["Last migration", formatDateTime(o.system.lastMigration, tz, { withYear: true })],
              ["Node.js", o.system.node],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between gap-3">
                <dt className="text-muted">{k}</dt><dd className="truncate text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="New sign-ups" action={viewAll("/admin/users")}>
          {o.recentUsers.length === 0 ? <Empty>No users yet.</Empty> : (
            <ul>
              {o.recentUsers.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted">
                    <Avatar name={u.name || u.email} image={u.image} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{u.name || u.email}</span>
                      <span className="block truncate text-xs text-muted">{u.username ? `/${u.username}` : "Not onboarded"}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(u.createdAt, now)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent bookings" action={viewAll("/admin/bookings")}>
          {o.recentBookings.length === 0 ? <Empty>No bookings yet.</Empty> : (
            <ul>
              {o.recentBookings.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{b.guestName} <span className="font-normal text-muted">→</span> <Link href={`/admin/users/${b.hostId}`} className="hover:text-accent">{b.hostName || b.username}</Link></span>
                    <span className="block truncate text-xs text-muted">{b.eventTitle} · {formatDateTime(b.start, tz)}</span>
                  </span>
                  {b.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge> : <span className="shrink-0 text-xs text-muted">{timeAgo(b.createdAt, now)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Top hosts (30 days)">
          {o.topHosts.length === 0 ? <Empty>No bookings in the last 30 days.</Empty> : (
            <ol>
              {o.topHosts.map((h, i) => (
                <li key={h.id}>
                  <Link href={`/admin/users/${h.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted">
                    <span className="w-5 text-center text-xs tabular-nums text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{h.name || h.email}</span>
                      <span className="block truncate text-xs text-muted">/{h.username}</span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">{h.bookings}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
