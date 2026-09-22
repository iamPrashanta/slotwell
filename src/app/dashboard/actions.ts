"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { pool } from "@server/db.mjs";
import { requireOwner } from "@/server/session";
import { BookingError, cancelBookingAsOwner, retryGoogleSync } from "@/server/bookings";
import { usernameSchema } from "@/lib/usernames";
import { isValidTimeZone, parseDate, parseTimeOfDay } from "@/lib/availability/time";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };


function fail(error: unknown): ActionResult {
  if (error instanceof BookingError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Please check the form." };
  const code = (error as { code?: string }).code;
  if (code === "23505") return { ok: false, error: "That link is already used. Pick another." };
  if (code === "23514") return { ok: false, error: "That username isn't allowed. Pick another." };
  if (code === "23503") return { ok: false, error: "This is still used by bookings." };
  console.error("dashboard action failed:", error instanceof Error ? error.message : error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const time = z.string().refine((v) => parseTimeOfDay(v) !== null, "Use HH:MM times");

// ---------- Meeting types ----------

const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().trim().min(1, "Every question needs a label").max(200),
  type: z.enum(["text", "textarea", "select"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
});

const eventTypeSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Add a title").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{0,48}$/, "The link can use lowercase letters, numbers and dashes"),
  description: z.string().trim().max(2000),
  durationMin: z.number().int().min(5).max(480),
  locationKind: z.enum(["google_meet", "phone", "custom"]),
  locationValue: z.string().trim().max(500),
  bufferBeforeMin: z.number().int().min(0).max(240),
  bufferAfterMin: z.number().int().min(0).max(240),
  minNoticeMin: z.number().int().min(0).max(60 * 24 * 30),
  maxDaysAhead: z.number().int().min(1).max(365),
  slotIntervalMin: z.number().int().min(5).max(240),
  dailyLimit: z.number().int().min(1).max(50).nullable(),
  questions: z.array(questionSchema).max(10),
  isActive: z.boolean(),
});

export type EventTypeInput = z.infer<typeof eventTypeSchema>;

export async function saveEventType(input: EventTypeInput): Promise<ActionResult> {
  const session = await requireOwner();
  try {
    const d = eventTypeSchema.parse(input);
    const questions = d.questions.map((q) => ({ ...q, options: q.type === "select" ? (q.options ?? []) : undefined }));
    if (questions.some((q) => q.type === "select" && !q.options?.length)) {
      return { ok: false, error: "Dropdown questions need at least one option." };
    }
    const values = [
      d.title, d.slug, d.description, d.durationMin, d.locationKind, d.locationValue, d.bufferBeforeMin, d.bufferAfterMin,
      d.minNoticeMin, d.maxDaysAhead, d.slotIntervalMin, d.dailyLimit, JSON.stringify(questions), d.isActive,
    ];
    let id = d.id;
    if (id) {
      const res = await pool.query(
        `UPDATE event_types SET title=$3, slug=$4, description=$5, duration_min=$6, location_kind=$7, location_value=$8,
           buffer_before_min=$9, buffer_after_min=$10, min_notice_min=$11, max_days_ahead=$12, slot_interval_min=$13,
           daily_limit=$14, questions=$15, is_active=$16, updated_at=now()
         WHERE id=$1 AND owner_id=$2`,
        [id, session.user.id, ...values],
      );
      if (res.rowCount !== 1) return { ok: false, error: "Meeting type not found." };
    } else {
      const res = await pool.query(
        `INSERT INTO event_types (owner_id, title, slug, description, duration_min, location_kind, location_value,
           buffer_before_min, buffer_after_min, min_notice_min, max_days_ahead, slot_interval_min, daily_limit, questions,
           is_active, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
           (SELECT coalesce(max(position),0)+1 FROM event_types WHERE owner_id=$1))
         RETURNING id`,
        [session.user.id, ...values],
      );
      id = res.rows[0].id;
    }
    refresh();
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function setEventTypeActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await requireOwner();
  try {
    await pool.query("UPDATE event_types SET is_active=$3, updated_at=now() WHERE id=$1 AND owner_id=$2", [
      z.uuid().parse(id),
      session.user.id,
      isActive,
    ]);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteEventType(id: string): Promise<ActionResult> {
  const session = await requireOwner();
  try {
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM bookings WHERE event_type_id = $1 AND owner_id = $2", [z.uuid().parse(id), session.user.id]);
    if (rows[0].n > 0) {
      return { ok: false, error: "This meeting type has bookings. Switch it off instead of deleting it." };
    }
    await pool.query("DELETE FROM event_types WHERE id=$1 AND owner_id=$2", [id, session.user.id]);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------- Availability ----------

const availabilitySchema = z.object({
  timeZone: z.string().refine(isValidTimeZone, "Unknown time zone"),
  rules: z
    .array(z.object({ weekday: z.number().int().min(1).max(7), start: time, end: time }))
    .max(50)
    .refine((rules) => rules.every((r) => parseTimeOfDay(r.start)! < parseTimeOfDay(r.end)!), "Each range must end after it starts"),
});

export async function saveAvailability(input: z.infer<typeof availabilitySchema>): Promise<ActionResult> {
  const session = await requireOwner();
  const client = await pool.connect();
  try {
    const d = availabilitySchema.parse(input);
    await client.query("BEGIN");
    await client.query("UPDATE owner_settings SET time_zone=$2, updated_at=now() WHERE owner_id=$1", [session.user.id, d.timeZone]);
    await client.query("DELETE FROM availability_rules WHERE owner_id=$1", [session.user.id]);
    for (const r of d.rules) {
      await client.query(
        "INSERT INTO availability_rules (owner_id, weekday, start_time, end_time) VALUES ($1,$2,$3,$4)",
        [session.user.id, r.weekday, r.start, r.end],
      );
    }
    await client.query("COMMIT");
    refresh();
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return fail(error);
  } finally {
    client.release();
  }
}

const overrideSchema = z
  .object({
    date: z.string().refine((v) => parseDate(v) !== null, "Pick a date"),
    unavailable: z.boolean(),
    start: time.optional(),
    end: time.optional(),
  })
  .refine((o) => o.unavailable || (o.start && o.end && parseTimeOfDay(o.start)! < parseTimeOfDay(o.end)!), {
    message: "Hours must end after they start",
  });

export async function addDateOverride(input: z.infer<typeof overrideSchema>): Promise<ActionResult> {
  const session = await requireOwner();
  const client = await pool.connect();
  try {
    const d = overrideSchema.parse(input);
    await client.query("BEGIN");
    // A day off replaces everything else on that date.
    if (d.unavailable) await client.query("DELETE FROM date_overrides WHERE owner_id=$1 AND date=$2", [session.user.id, d.date]);
    else await client.query("DELETE FROM date_overrides WHERE owner_id=$1 AND date=$2 AND is_unavailable", [session.user.id, d.date]);
    await client.query(
      "INSERT INTO date_overrides (owner_id, date, is_unavailable, start_time, end_time) VALUES ($1,$2,$3,$4,$5)",
      [session.user.id, d.date, d.unavailable, d.unavailable ? null : d.start, d.unavailable ? null : d.end],
    );
    await client.query("COMMIT");
    refresh();
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return fail(error);
  } finally {
    client.release();
  }
}

export async function removeDateOverride(id: string): Promise<ActionResult> {
  const session = await requireOwner();
  try {
    await pool.query("DELETE FROM date_overrides WHERE id=$1 AND owner_id=$2", [z.uuid().parse(id), session.user.id]);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------- Profile ----------

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Add your name").max(80),
  username: usernameSchema,
  bio: z.string().trim().max(300),
});

export async function saveProfile(input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const session = await requireOwner();
  try {
    const d = profileSchema.parse(input);
    await pool.query(
      "UPDATE owner_settings SET display_name=$2, username=$3, bio=$4, updated_at=now() WHERE owner_id=$1",
      [session.user.id, d.displayName, d.username, d.bio],
    );
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------- Bookings ----------

export async function cancelBookingByOwner(id: string, reason: string): Promise<ActionResult> {
  const session = await requireOwner();
  try {
    await cancelBookingAsOwner(session.user.id, z.uuid().parse(id), z.string().trim().max(500).parse(reason));
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function retryBookingSync(id: string): Promise<ActionResult> {
  const session = await requireOwner();
  try {
    await retryGoogleSync(session.user.id, z.uuid().parse(id));
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
