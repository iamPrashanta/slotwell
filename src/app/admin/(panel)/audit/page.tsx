import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge, Empty, Pagination, formatDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/server/admin-auth";
import { PAGE_SIZE, listAudit } from "@/server/admin-data";
import { adminTimeZone } from "@/server/admin-prefs";

export const metadata: Metadata = { title: "Audit log" };

const tone = (action: string) =>
  /failed|rate_limited/.test(action) ? "bad" : /suspended|removed|revoked|cancelled/.test(action) ? "warn" : action.startsWith("admin.") ? "accent" : "neutral";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireAdmin();
  await connection();
  const page = Math.max(1, Math.min(10_000, Number((await searchParams).page) || 1));
  const [{ entries, total }, tz] = await Promise.all([listAudit(page), adminTimeZone(session.user.id)]);

  return (
    <>
      <PageHeader title="Audit log" description="Every admin sign-in and action. Entries can't be edited or deleted from the app." />
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {entries.length === 0 ? <Empty>Nothing yet.</Empty> : (
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="w-32 shrink-0 text-xs tabular-nums text-muted">{formatDateTime(e.createdAt, tz, { withYear: true })}</span>
                <Badge tone={tone(e.action) as "bad" | "warn" | "accent" | "neutral"}>{e.action}</Badge>
                <span className="min-w-0 flex-1 truncate text-muted">
                  by <span className="text-foreground">{e.adminEmail ?? "deleted user"}</span>
                  {e.targetType === "user" && e.targetId && <> · <Link href={`/admin/users/${e.targetId}`} className="text-accent hover:underline">user</Link></>}
                  {e.targetType === "booking" && e.targetId && <> · booking {e.targetId.slice(0, 8)}</>}
                  {typeof e.details.reason === "string" && e.details.reason && <> · “{e.details.reason}”</>}
                </span>
                <span className="text-xs tabular-nums text-muted">{e.ip ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} params={{}} />
    </>
  );
}
