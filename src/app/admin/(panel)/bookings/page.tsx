import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge, Empty, FilterBar, FilterSelect, Pagination, formatDateTime } from "@/components/admin/ui";
import { AdminCancelBooking } from "@/components/admin/cancel-booking";
import { requireAdmin } from "@/server/admin-auth";
import { PAGE_SIZE, listAllBookings, type BookingStatusFilter, type BookingWhen } from "@/server/admin-data";
import { adminTimeZone } from "@/server/admin-prefs";

export const metadata: Metadata = { title: "Bookings" };

const STATUS: [BookingStatusFilter, string][] = [["all", "Any status"], ["confirmed", "Confirmed"], ["cancelled", "Cancelled"]];
const WHEN: [BookingWhen, string][] = [["all", "Any time"], ["upcoming", "Upcoming"], ["past", "Past"]];
const SYNC: ["0" | "1", string][] = [["0", "All"], ["1", "Sync errors only"]];
const pick = <T extends string>(v: string | undefined, list: [T, string][], fallback: T): T => (list.some(([k]) => k === v) ? (v as T) : fallback);

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireAdmin();
  await connection();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const status = pick(sp.status, STATUS, "all");
  const when = pick(sp.when, WHEN, "all");
  const sync = pick(sp.sync, SYNC, "0");
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));
  const [{ bookings, total }, tz] = await Promise.all([
    listAllBookings({ q, status, when, syncErrors: sync === "1", page }),
    adminTimeZone(session.user.id),
  ]);

  return (
    <>
      <PageHeader title="Bookings" description={`${total} across all users · times in ${tz.replaceAll("_", " ")}`} />
      <FilterBar q={q} placeholder="Search guest, host, email or meeting">
        <FilterSelect name="when" value={when} options={WHEN} label="When" />
        <FilterSelect name="status" value={status} options={STATUS} label="Status" />
        <FilterSelect name="sync" value={sync} options={SYNC} label="Calendar sync" />
      </FilterBar>

      {bookings.length === 0 ? (
        <div className="rounded-card border border-border bg-surface"><Empty>No bookings match.</Empty></div>
      ) : (
        <ul className="flex flex-col gap-2">
          {bookings.map((b) => (
            <li key={b.id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <div className="w-32 shrink-0 text-sm">
                  <p className={b.status === "cancelled" ? "text-muted line-through" : "font-medium"}>{formatDateTime(b.start, tz)}</p>
                  <p className="text-xs text-muted">{b.durationMin} min</p>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{b.guestName} <span className="font-normal text-muted">· {b.guestEmail}</span></p>
                  <p className="truncate text-muted">
                    {b.eventTitle} with{" "}
                    <Link href={`/admin/users/${b.hostId}`} className="text-foreground hover:text-accent">{b.hostName || b.hostEmail}</Link>
                    {b.username && <span> (/{b.username})</span>}
                  </p>
                  {b.cancelReason && <p className="mt-1 truncate text-xs text-muted">Reason: {b.cancelReason}</p>}
                  {b.syncError && b.status === "confirmed" && <p className="mt-1 truncate text-xs text-danger">Sync: {b.syncError}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {b.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge> : b.isUpcoming ? <Badge tone="good">Upcoming</Badge> : <Badge>Done</Badge>}
                  {b.isUpcoming && <AdminCancelBooking id={b.id} guest={b.guestName} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE}
        params={{ q, status: status === "all" ? undefined : status, when: when === "all" ? undefined : when, sync: sync === "1" ? "1" : undefined }} />
    </>
  );
}
