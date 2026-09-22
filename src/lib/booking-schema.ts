import { z } from "zod";
import { isValidTimeZone } from "@/lib/availability/time";

/** Request body for creating a booking. Shared with the booking form. */
export const createBookingSchema = z.object({
  user: z.string().min(2).max(39),
  event: z.string().min(1).max(49),
  start: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(1).max(120).regex(/^[^\u0000-\u001f\u007f]*$/, "Invalid name"),
  email: z.email().max(254),
  timeZone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone"),
  notes: z.string().trim().max(2000).default(""),
  answers: z
    .record(z.string().max(40), z.string().max(2000))
    .refine((a) => Object.keys(a).length <= 20, "Too many answers")
    .default({}),
  // Manage token of the booking being moved (reschedule flow).
  rescheduleToken: z.string().min(20).max(100).optional(),
  // Honeypot: real people never fill this hidden field (checked in the route, not here).
  website: z.string().max(200).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(500).default(""),
});
