import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EventTypeRow } from "@/components/dashboard/event-type-row";
import { ButtonLink } from "@/components/ui/button";
import { requireOwner } from "@/server/session";
import { getOwnerById, listEventTypes } from "@/server/data";
import { appConfig } from "@/server/config";

export const metadata: Metadata = { title: "Meeting types", robots: { index: false, follow: false } };

export default async function EventTypesPage() {
  const session = await requireOwner();
  const [owner, events] = await Promise.all([getOwnerById(session.user.id), listEventTypes(session.user.id, { activeOnly: false })]);

  return (
    <>
      <PageHeader
        title="Meeting types"
        description="Each type has its own link, length and questions. Switch one off to hide it without deleting it."
        actions={<ButtonLink href="/dashboard/event-types/new" size="sm"><Plus className="h-4 w-4" aria-hidden /> New type</ButtonLink>}
      />
      {events.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-muted">No meeting types yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => (
            <EventTypeRow key={e.id} event={e} url={`${appConfig.appUrl}/${owner?.username}/${e.slug}`} />
          ))}
        </ul>
      )}
    </>
  );
}
