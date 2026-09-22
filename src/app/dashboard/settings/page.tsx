import type { Metadata } from "next";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmbedSnippets, ProfileForm } from "@/components/dashboard/settings-forms";
import { Card } from "@/components/ui/form";
import { requireOwner } from "@/server/session";
import { getGoogleAccount, getOwnerById, listEventTypes } from "@/server/data";
import { calendarEnabled } from "@/server/google-calendar";
import { appConfig } from "@/server/config";
import { GOOGLE_CALENDAR_SCOPES } from "@server/auth.mjs";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const session = await requireOwner();
  const [owner, google, events] = await Promise.all([
    getOwnerById(session.user.id),
    getGoogleAccount(session.user.id),
    listEventTypes(session.user.id),
  ]);
  if (!owner) return null;
  const granted = google?.scope?.split(/[ ,]+/) ?? [];
  const calendarReady = GOOGLE_CALENDAR_SCOPES.every((s) => granted.includes(s));
  const firstSlug = events[0]?.slug ?? "30min";

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6">
        <ProfileForm initial={{ displayName: owner.displayName, username: owner.username, bio: owner.bio }} appUrl={appConfig.appUrl} />

        <Card title="Calendar" description="Slotwell reads busy times and adds bookings to your Google Calendar.">
          {!calendarEnabled ? (
            <p className="flex items-start gap-3 text-sm text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              Demo mode: Google Calendar is turned off (CALENDAR_PROVIDER=none).
            </p>
          ) : calendarReady ? (
            <p className="flex items-start gap-3 text-sm">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              Connected as {session.user.email}. Busy times come from: {owner.busyCalendarIds.join(", ")}.
            </p>
          ) : (
            <p className="flex items-start gap-3 text-sm">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              Not connected. Sign out and sign in with Google, and allow calendar access.
            </p>
          )}
        </Card>

        <EmbedSnippets
          bookingUrl={`${appConfig.appUrl}/${owner.username}/${firstSlug}`}
          embedUrl={`${appConfig.appUrl}/embed/${owner.username}/${firstSlug}`}
        />
      </div>
    </>
  );
}
