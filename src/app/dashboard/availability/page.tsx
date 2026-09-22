import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DateOverridesEditor, WeeklyHoursEditor } from "@/components/dashboard/availability-editor";
import { requireOwner } from "@/server/session";
import { getOwnerById, getWeeklyRules } from "@/server/data";
import { listDateOverrides } from "@/server/dashboard-data";

export const metadata: Metadata = { title: "Availability", robots: { index: false, follow: false } };

export default async function AvailabilityPage() {
  const session = await requireOwner();
  const [owner, rules, overrides] = await Promise.all([
    getOwnerById(session.user.id),
    getWeeklyRules(session.user.id),
    listDateOverrides(session.user.id),
  ]);
  return (
    <>
      <PageHeader title="Availability" description="When people can book you. Busy times in your calendar are always removed." />
      <div className="flex flex-col gap-6">
        <WeeklyHoursEditor initialRules={rules} initialTimeZone={owner?.timeZone ?? "UTC"} />
        <DateOverridesEditor overrides={overrides} />
      </div>
    </>
  );
}
