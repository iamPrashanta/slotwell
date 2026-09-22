import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, type AvailabilityInput } from "./engine.ts";

const H = 3_600_000;
const M = 60_000;
const ist = (day: number, hour: number, minute = 0) => Date.UTC(2026, 8, day, hour, minute) - 5.5 * H; // Sep 2026, Asia/Kolkata

function base(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    ownerTimeZone: "Asia/Kolkata",
    rules: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "10:00", end: "12:00" })),
    overrides: [],
    event: {
      durationMin: 30,
      slotIntervalMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      minNoticeMin: 0,
      maxDaysAhead: 60,
      dailyLimit: null,
    },
    calendarBusy: [],
    blockedByBookings: [],
    from: ist(21, 0), // Monday 21 Sep 2026
    to: ist(22, 0),
    now: ist(1, 0),
    ...overrides,
  };
}

const times = (slots: { start: number }[]) =>
  slots.map((s) => new Date(s.start + 5.5 * H).toISOString().slice(11, 16)); // back to IST wall time

test("weekly rules produce slots in the owner's zone", () => {
  assert.deepEqual(times(computeSlots(base())), ["10:00", "10:30", "11:00", "11:30"]);
});

test("weekends have no slots", () => {
  assert.equal(computeSlots(base({ from: ist(19, 0), to: ist(21, 0) })).length, 0);
});

test("a slot must fit entirely inside the window", () => {
  const slots = computeSlots(base({ event: { ...base().event, durationMin: 45 } }));
  assert.deepEqual(times(slots), ["10:00", "10:30", "11:00"]);
});

test("calendar busy time removes overlapping slots, widened by buffers", () => {
  const slots = computeSlots(
    base({
      calendarBusy: [{ start: ist(21, 11), end: ist(21, 11, 30) }],
      event: { ...base().event, bufferBeforeMin: 10 },
    }),
  );
  // 11:30 would start right after the busy block, but needs 10 minutes before it.
  assert.deepEqual(times(slots), ["10:00", "10:30"]);
});

test("existing bookings (with their buffers) block slots", () => {
  const slots = computeSlots(base({ blockedByBookings: [{ start: ist(21, 10), end: ist(21, 10, 40) }] }));
  assert.deepEqual(times(slots), ["11:00", "11:30"]);
});

test("minimum notice hides slots that are too soon", () => {
  const slots = computeSlots(base({ now: ist(21, 9, 0), event: { ...base().event, minNoticeMin: 90 } }));
  assert.deepEqual(times(slots), ["10:30", "11:00", "11:30"]);
});

test("max days ahead caps the range", () => {
  const slots = computeSlots(base({ now: ist(1, 0), event: { ...base().event, maxDaysAhead: 5 } }));
  assert.equal(slots.length, 0);
});

test("an unavailable override removes the day; a custom override replaces the hours", () => {
  assert.equal(computeSlots(base({ overrides: [{ date: "2026-09-21", unavailable: true }] })).length, 0);
  const custom = computeSlots(base({ overrides: [{ date: "2026-09-21", unavailable: false, start: "15:00", end: "16:00" }] }));
  assert.deepEqual(times(custom), ["15:00", "15:30"]);
});

test("the daily limit closes a day once reached", () => {
  const event = { ...base().event, dailyLimit: 2 };
  assert.equal(computeSlots(base({ event, bookingsPerDay: { "2026-09-21": 2 } })).length, 0);
  assert.equal(computeSlots(base({ event, bookingsPerDay: { "2026-09-21": 1 } })).length, 4);
});

test("slots are returned as UTC instants with the right duration", () => {
  const [first] = computeSlots(base());
  assert.equal(new Date(first.start).toISOString(), "2026-09-21T04:30:00.000Z");
  assert.equal(first.end - first.start, 30 * M);
});

test("owner hours in New York stay at 9:00 local across the DST change", () => {
  const slots = computeSlots({
    ...base(),
    ownerTimeZone: "America/New_York",
    rules: [{ weekday: 5, start: "09:00", end: "09:30" }, { weekday: 1, start: "09:00", end: "09:30" }],
    from: Date.UTC(2026, 9, 30),
    to: Date.UTC(2026, 10, 3),
    now: Date.UTC(2026, 9, 1),
  });
  assert.deepEqual(
    slots.map((s) => new Date(s.start).toISOString()),
    ["2026-10-30T13:00:00.000Z", "2026-11-02T14:00:00.000Z"],
  );
});
