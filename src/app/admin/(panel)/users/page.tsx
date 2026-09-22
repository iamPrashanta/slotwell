import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Avatar, Badge, Empty, FilterBar, FilterSelect, Pagination, formatDate, timeAgo } from "@/components/admin/ui";
import { requireAdmin } from "@/server/admin-auth";
import { PAGE_SIZE, listUsers, type UserFilter, type UserSort } from "@/server/admin-data";
import { adminTimeZone, requestNow } from "@/server/admin-prefs";

export const metadata: Metadata = { title: "Users" };

const FILTERS: [UserFilter, string][] = [["all", "All users"], ["active", "Active"], ["banned", "Suspended"], ["admins", "Admins"], ["not_onboarded", "Not onboarded"]];
const SORTS: [UserSort, string][] = [["newest", "Newest"], ["oldest", "Oldest"], ["bookings", "Most bookings"], ["last_seen", "Last seen"]];
const pick = <T extends string>(v: string | undefined, list: [T, string][], fallback: T): T => (list.some(([k]) => k === v) ? (v as T) : fallback);

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireAdmin();
  await connection();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const filter = pick(sp.filter, FILTERS, "all");
  const sort = pick(sp.sort, SORTS, "newest");
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));
  const [{ users, total }, tz] = await Promise.all([listUsers({ q, filter, sort, page }), adminTimeZone(session.user.id)]);
  const now = requestNow();

  return (
    <>
      <PageHeader title="Users" description={`${total} ${total === 1 ? "account" : "accounts"}`} />
      <FilterBar q={q} placeholder="Search name, email or username">
        <FilterSelect name="filter" value={filter} options={FILTERS} label="Filter" />
        <FilterSelect name="sort" value={sort} options={SORTS} label="Sort" />
      </FilterBar>

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {users.length === 0 ? <Empty>No users match.</Empty> : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Types</th>
                  <th className="px-4 py-3 text-right font-medium">Bookings</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Last seen</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="group relative hover:bg-surface-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                        <Avatar name={u.name || u.email} image={u.image} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{u.name || "—"}</span>
                          <span className="block truncate text-xs text-muted">{u.email}{u.username ? ` · /${u.username}` : ""}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><UserBadges u={u} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{u.eventTypes}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{u.bookings}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(u.createdAt, tz)}</td>
                    <td className="px-4 py-3 text-muted">{timeAgo(u.lastSeen, now)}</td>
                    <td className="pr-3"><ChevronRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5" aria-hidden /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-border md:hidden">
              {users.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-muted">
                    <Avatar name={u.name || u.email} image={u.image} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.name || u.email}</span>
                      <span className="block truncate text-xs text-muted">{u.email}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1"><UserBadges u={u} /></span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted">
                      <span className="block text-sm font-medium tabular-nums text-foreground">{u.bookings}</span>bookings
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} params={{ q, filter: filter === "all" ? undefined : filter, sort: sort === "newest" ? undefined : sort }} />
    </>
  );
}

function UserBadges({ u }: { u: { banned: boolean; role: string; username: string | null; google: boolean } }) {
  return (
    <span className="flex flex-wrap gap-1">
      {u.banned ? <Badge tone="bad">Suspended</Badge> : <Badge tone="good">Active</Badge>}
      {u.role === "admin" && <Badge tone="warn">Admin</Badge>}
      {!u.username && <Badge>Not onboarded</Badge>}
      {u.google && <Badge tone="accent">Google</Badge>}
    </span>
  );
}
