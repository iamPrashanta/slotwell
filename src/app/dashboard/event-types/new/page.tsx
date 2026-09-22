import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EventTypeForm } from "@/components/dashboard/event-type-form";
import { requireOwner } from "@/server/session";
import { getOwnerById } from "@/server/data";
import { appConfig } from "@/server/config";

export const metadata: Metadata = { title: "New meeting type", robots: { index: false, follow: false } };

export default async function NewEventTypePage() {
  const session = await requireOwner();
  const owner = await getOwnerById(session.user.id);
  return (
    <>
      <Link href="/dashboard/event-types" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Meeting types
      </Link>
      <PageHeader title="New meeting type" />
      <EventTypeForm
        publicBase={`${appConfig.appUrl}/${owner?.username ?? ""}`}
        initial={{
          title: "",
          slug: "",
          description: "",
          durationMin: 30,
          locationKind: "google_meet",
          locationValue: "",
          bufferBeforeMin: 0,
          bufferAfterMin: 10,
          minNoticeMin: 240,
          maxDaysAhead: 60,
          slotIntervalMin: 30,
          dailyLimit: null,
          questions: [],
          isActive: true,
        }}
      />
    </>
  );
}
