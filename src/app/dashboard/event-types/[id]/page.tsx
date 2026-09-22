import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EventTypeForm } from "@/components/dashboard/event-type-form";
import { requireOwner } from "@/server/session";
import { getEventTypeById, getOwnerById } from "@/server/data";
import { appConfig } from "@/server/config";

export const metadata: Metadata = { title: "Edit meeting type", robots: { index: false, follow: false } };

export default async function EditEventTypePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOwner();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [owner, event] = await Promise.all([getOwnerById(session.user.id), getEventTypeById(session.user.id, id)]);
  if (!event) notFound();

  return (
    <>
      <Link href="/dashboard/event-types" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Meeting types
      </Link>
      <PageHeader title={event.title} />
      <EventTypeForm
        publicBase={`${appConfig.appUrl}/${owner?.username ?? ""}`}
        initial={{
          id: event.id,
          title: event.title,
          slug: event.slug,
          description: event.description,
          durationMin: event.durationMin,
          locationKind: event.locationKind,
          locationValue: event.locationValue,
          bufferBeforeMin: event.bufferBeforeMin,
          bufferAfterMin: event.bufferAfterMin,
          minNoticeMin: event.minNoticeMin,
          maxDaysAhead: event.maxDaysAhead,
          slotIntervalMin: event.slotIntervalMin,
          dailyLimit: event.dailyLimit,
          questions: event.questions.map((q) => ({ ...q, required: Boolean(q.required) })),
          isActive: event.isActive,
        }}
      />
    </>
  );
}
