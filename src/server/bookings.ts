import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pool } from "@server/db.mjs";
import type { CreateBookingInput } from "@/lib/booking-schema";
import { findSlots } from "./availability";
import { appConfig } from "./config";
import { getEventType, getEventTypeById, getOwnerByUsername, getOwnerEmail, type EventType, type OwnerProfile } from "./data";
import { sendBookingEmail } from "./email";
import { CalendarNotConnectedError, calendarEnabled, createCalendarEvent, deleteCalendarEvent } from "./google-calendar";

const MINUTE = 60_000;

/** An error that maps to an HTTP status and a message that is safe to show guests. */
export class BookingError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function manageUrl(token: string): string {
  return `${appConfig.appUrl}/booking/${token}`;
}

/** "Monday, 21 September 2026, 10:00 – 10:30 GMT+5:30" in the given zone. */
export function formatWhen(start: Date, end: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }).format(start);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  const zone = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(start)
    .find((p) => p.type === "timeZoneName")?.value;
  return `${day}, ${time.format(start)} – ${time.format(end)} ${zone ?? timeZone}`;
}

interface BookingRow {
  id: string;
  owner_id: string;
  event_type_id: string;
  start_at: Date;
  end_at: Date;
  status: "confirmed" | "cancelled";
  guest_name: string;
  guest_email: string;
  guest_time_zone: string;
  notes: string;
  answers: Record<string, string>;
  location_url: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  ics_uid: string;
  ics_sequence: number;
  cancel_reason: string | null;
}

async function findByToken(token: string): Promise<BookingRow | null> {
  const { rows } = await pool.query<BookingRow>("SELECT * FROM bookings WHERE manage_token_hash = $1", [hashToken(token)]);
  return rows[0] ?? null;
}

/** Keeps only answers to this event's questions and checks required/select values. */
function cleanAnswers(event: EventType, answers: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const question of event.questions) {
    const value = (answers[question.id] ?? "").trim();
    if (question.required && !value) throw new BookingError(400, `Please answer: ${question.label}`);
    if (value && question.type === "select" && !(question.options ?? []).includes(value)) {
      throw new BookingError(400, `Please choose a valid option for: ${question.label}`);
    }
    if (value) clean[question.id] = value;
  }
  return clean;
}

function locationLabel(event: EventType, url: string | null): string {
  if (url) return url;
  if (event.locationKind === "google_meet") return "Google Meet (link to follow)";
  if (event.locationKind === "phone") return "Phone call";
  return event.locationValue || "Online";
}

function answerLines(event: EventType, answers: Record<string, string>): string[] {
  return event.questions.filter((q) => answers[q.id]).map((q) => `${q.label}: ${answers[q.id]}`);
}

export interface CreatedBooking {
  id: string;
  start: string;
  end: string;
  locationUrl: string | null;
  manageUrl: string;
}

/**
 * Creates (or, with `rescheduleToken`, moves) a booking:
 * fresh slot check → transactional insert guarded by bookings_no_overlap →
 * Google event with Meet link → confirmation emails. Google and email failures
 * never undo a saved booking; they are recorded in `sync_error` / the log.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const owner = await getOwnerByUsername(input.user);
  const event = owner ? await getEventType(owner.ownerId, input.event) : null;
  if (!owner || !event) throw new BookingError(404, "This booking link doesn't exist.");

  const start = new Date(input.start);
  const end = new Date(start.getTime() + event.durationMin * MINUTE);
  const answers = cleanAnswers(event, input.answers);

  const previous = input.rescheduleToken ? await findByToken(input.rescheduleToken) : null;
  if (input.rescheduleToken) {
    if (!previous || previous.owner_id !== owner.ownerId) throw new BookingError(404, "The booking to reschedule wasn't found.");
    if (previous.status !== "confirmed") throw new BookingError(409, "That booking was already cancelled.");
    if (previous.start_at.getTime() <= Date.now()) throw new BookingError(409, "Past bookings can't be rescheduled.");
  }

  // Re-check against live calendar data right before saving.
  let slots;
  try {
    slots = await findSlots(owner, event, start, new Date(start.getTime() + MINUTE), {
      fresh: true,
      excludeBookingId: previous?.id,
    });
  } catch (error) {
    if (error instanceof CalendarNotConnectedError) throw new BookingError(503, "Booking is temporarily unavailable.");
    throw error;
  }
  if (!slots.some((slot) => slot.start === start.getTime())) {
    throw new BookingError(409, "That time is no longer available. Please pick another.");
  }

  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const icsUid = previous?.ics_uid ?? `${id}@slotwell`;
  const icsSequence = previous ? previous.ics_sequence + 1 : 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (previous) {
      const moved = await client.query(
        `UPDATE bookings SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Rescheduled', updated_at = now()
          WHERE id = $1 AND status = 'confirmed'`,
        [previous.id],
      );
      if (moved.rowCount !== 1) throw new BookingError(409, "That booking was already changed.");
    }
    await client.query(
      `INSERT INTO bookings (id, owner_id, event_type_id, start_at, end_at, blocked, guest_name, guest_email,
                             guest_time_zone, notes, answers, manage_token_hash, ics_uid, ics_sequence, rescheduled_from_id)
       VALUES ($1, $2, $3, $4, $5,
               tstzrange($4::timestamptz - make_interval(mins => $6), $5::timestamptz + make_interval(mins => $7), '[)'),
               $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        id,
        owner.ownerId,
        event.id,
        start.toISOString(),
        end.toISOString(),
        event.bufferBeforeMin,
        event.bufferAfterMin,
        input.name,
        input.email.toLowerCase(),
        input.timeZone,
        input.notes,
        JSON.stringify(answers),
        hashToken(token),
        icsUid,
        icsSequence,
        previous?.id ?? null,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23P01") {
      throw new BookingError(409, "That time was just taken. Please pick another.");
    }
    throw error;
  } finally {
    client.release();
  }

  if (previous?.google_event_id) {
    await deleteCalendarEvent(owner.ownerId, previous.google_calendar_id ?? owner.bookingCalendarId, previous.google_event_id).catch(
      (error: Error) => console.error("google delete (reschedule) failed:", error.message),
    );
  }

  const locationUrl = await syncToGoogle(owner, event, { id, start, end, name: input.name, email: input.email, notes: input.notes, answers });

  await sendConfirmationEmails(owner, event, {
    start,
    end,
    token,
    icsUid,
    icsSequence,
    locationUrl,
    guest: { name: input.name, email: input.email, timeZone: input.timeZone },
    notes: input.notes,
    answers,
    rescheduled: Boolean(previous),
  });

  return { id, start: start.toISOString(), end: end.toISOString(), locationUrl, manageUrl: manageUrl(token) };
}

async function syncToGoogle(
  owner: OwnerProfile,
  event: EventType,
  booking: { id: string; start: Date; end: Date; name: string; email: string; notes: string; answers: Record<string, string> },
): Promise<string | null> {
  const fallbackUrl = event.locationKind === "custom" && /^https?:\/\//.test(event.locationValue) ? event.locationValue : null;
  if (!calendarEnabled) {
    await pool.query("UPDATE bookings SET location_url = $2, updated_at = now() WHERE id = $1", [booking.id, fallbackUrl]);
    return fallbackUrl;
  }
  try {
    const created = await createCalendarEvent(owner.ownerId, {
      calendarId: owner.bookingCalendarId,
      summary: `${event.title}: ${booking.name} & ${owner.displayName}`,
      description: [
        booking.notes && `Notes: ${booking.notes}`,
        ...answerLines(event, booking.answers),
        `Guest: ${booking.name} <${booking.email}>`,
        "Booked with Slotwell",
      ]
        .filter(Boolean)
        .join("\n"),
      start: booking.start,
      end: booking.end,
      timeZone: owner.timeZone,
      attendees: [{ email: booking.email, displayName: booking.name }],
      requestId: booking.id,
      withGoogleMeet: event.locationKind === "google_meet",
      location: event.locationKind === "google_meet" ? undefined : locationLabel(event, fallbackUrl),
    });
    const locationUrl = created.hangoutLink ?? fallbackUrl;
    await pool.query(
      `UPDATE bookings SET google_event_id = $2, google_calendar_id = $3, location_url = $4, sync_error = NULL, updated_at = now()
        WHERE id = $1`,
      [booking.id, created.id, owner.bookingCalendarId, locationUrl],
    );
    return locationUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sync failed";
    console.error("google create failed:", message);
    await pool.query("UPDATE bookings SET sync_error = $2, location_url = $3, updated_at = now() WHERE id = $1", [
      booking.id,
      message.slice(0, 300),
      fallbackUrl,
    ]);
    return fallbackUrl;
  }
}

async function sendConfirmationEmails(
  owner: OwnerProfile,
  event: EventType,
  details: {
    start: Date;
    end: Date;
    token: string;
    icsUid: string;
    icsSequence: number;
    locationUrl: string | null;
    guest: { name: string; email: string; timeZone: string };
    notes: string;
    answers: Record<string, string>;
    rescheduled: boolean;
  },
) {
  const ownerEmail = await getOwnerEmail(owner.ownerId);
  const where = locationLabel(event, details.locationUrl);
  const verb = details.rescheduled ? "rescheduled" : "confirmed";
  const invite = {
    method: "REQUEST" as const,
    uid: details.icsUid,
    sequence: details.icsSequence,
    start: details.start,
    end: details.end,
    summary: `${event.title} with ${owner.displayName}`,
    description: [details.locationUrl && `Join: ${details.locationUrl}`, `Reschedule or cancel: ${manageUrl(details.token)}`]
      .filter(Boolean)
      .join("\n"),
    location: where,
    url: details.locationUrl ?? undefined,
    organizer: { name: owner.displayName, email: ownerEmail ?? "no-reply@slotwell.app" },
    attendee: { name: details.guest.name, email: details.guest.email },
  };

  const results = await Promise.allSettled([
    sendBookingEmail({
      to: details.guest.email,
      replyTo: ownerEmail ?? undefined,
      subject: `${details.rescheduled ? "Rescheduled" : "Confirmed"}: ${event.title} with ${owner.displayName}`,
      lines: [
        `Hi ${details.guest.name},`,
        `Your ${event.title.toLowerCase()} with ${owner.displayName} is ${verb}.`,
        `When: ${formatWhen(details.start, details.end, details.guest.timeZone)}`,
        `Where: ${where}`,
        "The attached invite adds it to your calendar.",
      ],
      action: { label: "Reschedule or cancel", url: manageUrl(details.token) },
      invite,
    }),
    ownerEmail
      ? sendBookingEmail({
          to: ownerEmail,
          replyTo: details.guest.email,
          subject: `${details.rescheduled ? "Rescheduled" : "New booking"}: ${details.guest.name} · ${event.title}`,
          lines: [
            `${details.guest.name} (${details.guest.email}) ${details.rescheduled ? "moved" : "booked"} ${event.title}.`,
            `When: ${formatWhen(details.start, details.end, owner.timeZone)}`,
            `Guest's time zone: ${details.guest.timeZone}`,
            `Where: ${where}`,
            ...(details.notes ? [`Notes: ${details.notes}`] : []),
            ...answerLines(event, details.answers),
          ],
        })
      : Promise.resolve(),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("booking email failed:", (result.reason as Error)?.message);
  }
}

export interface ManagedBooking {
  status: "confirmed" | "cancelled";
  isPast: boolean;
  start: string;
  end: string;
  guestName: string;
  guestEmail: string;
  guestTimeZone: string;
  locationUrl: string | null;
  cancelReason: string | null;
  event: { title: string; slug: string; durationMin: number };
  owner: { username: string; displayName: string };
}

/** Booking details for the guest's manage page, looked up by token. */
export async function getManagedBooking(token: string): Promise<ManagedBooking | null> {
  const { rows } = await pool.query(
    `SELECT b.status, b.start_at, b.end_at, b.guest_name, b.guest_email, b.guest_time_zone, b.location_url, b.cancel_reason,
            e.title, e.slug, e.duration_min, s.username, s.display_name, u.name AS user_name
       FROM bookings b
       JOIN event_types e ON e.id = b.event_type_id
       JOIN owner_settings s ON s.owner_id = b.owner_id
       JOIN "user" u ON u.id = b.owner_id
      WHERE b.manage_token_hash = $1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    status: row.status,
    isPast: new Date(row.start_at).getTime() <= Date.now(),
    start: new Date(row.start_at).toISOString(),
    end: new Date(row.end_at).toISOString(),
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestTimeZone: row.guest_time_zone,
    locationUrl: row.location_url,
    cancelReason: row.cancel_reason,
    event: { title: row.title, slug: row.slug, durationMin: row.duration_min },
    owner: { username: row.username, displayName: row.display_name || row.user_name || row.username },
  };
}

/** Guest cancellation via the manage link. */
export async function cancelBooking(token: string, reason: string): Promise<void> {
  const booking = await findByToken(token);
  if (!booking) throw new BookingError(404, "Booking not found.");
  await cancelRow(booking, reason, "guest");
}

/** Owner cancellation from the dashboard. */
export async function cancelBookingAsOwner(ownerId: string, bookingId: string, reason: string): Promise<void> {
  const { rows } = await pool.query<BookingRow>("SELECT * FROM bookings WHERE id = $1 AND owner_id = $2", [bookingId, ownerId]);
  if (!rows[0]) throw new BookingError(404, "Booking not found.");
  await cancelRow(rows[0], reason, "owner");
}

/** Owner: try creating the Google event again for a booking whose sync failed. */
export async function retryGoogleSync(ownerId: string, bookingId: string): Promise<void> {
  const { rows } = await pool.query<BookingRow>(
    "SELECT * FROM bookings WHERE id = $1 AND owner_id = $2 AND status = 'confirmed' AND google_event_id IS NULL",
    [bookingId, ownerId],
  );
  const booking = rows[0];
  if (!booking) throw new BookingError(404, "Nothing to retry for this booking.");
  const owner = await ownerProfile(ownerId);
  const event = owner ? await eventById(owner, booking.event_type_id) : null;
  if (!owner || !event) throw new BookingError(404, "Booking not found.");
  await syncToGoogle(owner, event, {
    id: booking.id,
    start: booking.start_at,
    end: booking.end_at,
    name: booking.guest_name,
    email: booking.guest_email,
    notes: booking.notes,
    answers: booking.answers,
  });
}

async function ownerProfile(ownerId: string): Promise<OwnerProfile | null> {
  const { rows } = await pool.query("SELECT username FROM owner_settings WHERE owner_id = $1", [ownerId]);
  // Includes suspended accounts so their existing bookings can still be cancelled / managed.
  return rows[0] ? getOwnerByUsername(rows[0].username, { includeBanned: true }) : null;
}

async function eventById(owner: OwnerProfile, eventTypeId: string): Promise<EventType | null> {
  // Includes switched-off event types, so their bookings can still be managed.
  return getEventTypeById(owner.ownerId, eventTypeId);
}

async function cancelRow(booking: BookingRow, reason: string, by: "guest" | "owner"): Promise<void> {
  if (booking.status !== "confirmed") throw new BookingError(409, "This booking is already cancelled.");
  if (booking.start_at.getTime() <= Date.now()) throw new BookingError(409, "Past bookings can't be cancelled.");

  const sequence = booking.ics_sequence + 1;
  const updated = await pool.query(
    `UPDATE bookings SET status = 'cancelled', cancelled_at = now(), cancel_reason = $2, ics_sequence = $3, updated_at = now()
      WHERE id = $1 AND status = 'confirmed'`,
    [booking.id, reason || null, sequence],
  );
  if (updated.rowCount !== 1) throw new BookingError(409, "This booking is already cancelled.");

  const owner = await ownerProfile(booking.owner_id);
  if (!owner) return;
  const event = await eventById(owner, booking.event_type_id);

  if (booking.google_event_id) {
    await deleteCalendarEvent(owner.ownerId, booking.google_calendar_id ?? owner.bookingCalendarId, booking.google_event_id).catch(
      (error: Error) => console.error("google delete failed:", error.message),
    );
  }

  const ownerEmail = await getOwnerEmail(owner.ownerId);
  const title = event?.title ?? "Meeting";
  const invite = {
    method: "CANCEL" as const,
    uid: booking.ics_uid,
    sequence,
    start: booking.start_at,
    end: booking.end_at,
    summary: `${title} with ${owner.displayName}`,
    organizer: { name: owner.displayName, email: ownerEmail ?? "no-reply@slotwell.app" },
    attendee: { name: booking.guest_name, email: booking.guest_email },
  };
  const when = formatWhen(booking.start_at, booking.end_at, booking.guest_time_zone);
  const results = await Promise.allSettled([
    sendBookingEmail({
      to: booking.guest_email,
      replyTo: ownerEmail ?? undefined,
      subject: `Cancelled: ${title} with ${owner.displayName}`,
      lines: [
        `Hi ${booking.guest_name},`,
        by === "owner"
          ? `${owner.displayName} had to cancel your ${title.toLowerCase()} on ${when}. Sorry for the change.`
          : `Your ${title.toLowerCase()} on ${when} has been cancelled.`,
        ...(by === "owner" && reason ? [`Message: ${reason}`] : []),
        "The attached update removes it from your calendar.",
      ],
      action: { label: "Book a new time", url: `${appConfig.appUrl}/${owner.username}/${event?.slug ?? ""}` },
      invite,
    }),
    by === "guest" && ownerEmail
      ? sendBookingEmail({
          to: ownerEmail,
          replyTo: booking.guest_email,
          subject: `Cancelled: ${booking.guest_name} · ${title}`,
          lines: [
            `${booking.guest_name} (${booking.guest_email}) cancelled ${title}.`,
            `When: ${formatWhen(booking.start_at, booking.end_at, owner.timeZone)}`,
            ...(reason ? [`Reason: ${reason}`] : []),
          ],
        })
      : Promise.resolve(),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("cancel email failed:", (result.reason as Error)?.message);
  }
}

/** Reschedule context for a booking page, or undefined when the token isn't usable for this event. */
export async function getRescheduleContext(token: string | undefined, username: string, slug: string) {
  if (!token || token.length < 20 || token.length > 100) return undefined;
  const booking = await getManagedBooking(token);
  if (!booking || booking.status !== "confirmed" || booking.isPast) return undefined;
  if (booking.owner.username !== username.toLowerCase() || booking.event.slug !== slug.toLowerCase()) return undefined;
  return {
    token,
    currentLabel: formatWhen(new Date(booking.start), new Date(booking.end), booking.guestTimeZone),
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
  };
}
