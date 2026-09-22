import "server-only";

import { auth } from "@server/auth.mjs";
import { getGoogleAccount } from "./data";
import type { Interval } from "@/lib/availability/engine";

const API = "https://www.googleapis.com/calendar/v3";

/**
 * CALENDAR_PROVIDER=none turns Google Calendar off (local demo): no busy times are read
 * and no events are created. Default is "google".
 */
export const calendarEnabled = (process.env.CALENDAR_PROVIDER ?? "google") !== "none";
const TIMEOUT_MS = 8000;

export class CalendarNotConnectedError extends Error {
  constructor() {
    super("Google Calendar is not connected.");
  }
}

async function accessToken(ownerId: string): Promise<string> {
  const account = await getGoogleAccount(ownerId);
  if (!account) throw new CalendarNotConnectedError();
  // Better Auth refreshes the token when it is about to expire.
  const tokens = await auth.api.getAccessToken({ body: { accountId: account.id, userId: ownerId } });
  if (!tokens?.accessToken) throw new CalendarNotConnectedError();
  return tokens.accessToken;
}

async function googleFetch<T>(ownerId: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken(ownerId)}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    // Keep the message short: Google error bodies can echo request data.
    throw new Error(`Google Calendar request failed (${response.status})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

interface FreeBusyResponse {
  calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }>;
}

/** Busy periods across the given calendars. Throws if any calendar could not be read. */
export async function getBusyTimes(ownerId: string, calendarIds: string[], from: Date, to: Date): Promise<Interval[]> {
  if (!calendarEnabled) return [];
  const data = await googleFetch<FreeBusyResponse>(ownerId, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: calendarIds.map((id) => ({ id })),
    }),
  });
  const busy: Interval[] = [];
  for (const [id, calendar] of Object.entries(data.calendars ?? {})) {
    if (calendar.errors?.length) throw new Error(`Could not read calendar ${id}: ${calendar.errors[0].reason}`);
    for (const period of calendar.busy ?? []) {
      busy.push({ start: Date.parse(period.start), end: Date.parse(period.end) });
    }
  }
  return busy;
}

export interface NewCalendarEvent {
  calendarId: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendees: { email: string; displayName?: string }[];
  /** Unique per booking so retries don't create duplicate Meet links. */
  requestId: string;
  withGoogleMeet: boolean;
  location?: string;
}

export interface CreatedCalendarEvent {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
}

/** Creates the event on the owner's calendar; Slotwell sends its own emails, so Google sends none. */
export async function createCalendarEvent(ownerId: string, event: NewCalendarEvent): Promise<CreatedCalendarEvent> {
  const params = new URLSearchParams({ sendUpdates: "none", conferenceDataVersion: event.withGoogleMeet ? "1" : "0" });
  return googleFetch<CreatedCalendarEvent>(ownerId, `/calendars/${encodeURIComponent(event.calendarId)}/events?${params}`, {
    method: "POST",
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: { dateTime: event.start.toISOString(), timeZone: event.timeZone },
      end: { dateTime: event.end.toISOString(), timeZone: event.timeZone },
      attendees: event.attendees,
      reminders: { useDefault: true },
      ...(event.withGoogleMeet
        ? { conferenceData: { createRequest: { requestId: event.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } } }
        : {}),
    }),
  });
}

export async function deleteCalendarEvent(ownerId: string, calendarId: string, eventId: string): Promise<void> {
  if (!calendarEnabled) return;
  await googleFetch<void>(
    ownerId,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "DELETE" },
  );
}
