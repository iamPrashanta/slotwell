import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, fromLocal, isoWeekday, parseDate, parseTimeOfDay, toLocal, zoneOffset } from "./time.ts";

test("India has a fixed +05:30 offset", () => {
  assert.equal(zoneOffset(Date.UTC(2026, 0, 1), "Asia/Kolkata"), 5.5 * 3_600_000);
  assert.equal(fromLocal({ year: 2026, month: 9, day: 17, hour: 10, minute: 0 }, "Asia/Kolkata"), Date.UTC(2026, 8, 17, 4, 30));
});

test("New York offset follows daylight saving", () => {
  // DST ends on Sunday 1 Nov 2026 in the US.
  assert.equal(fromLocal({ year: 2026, month: 10, day: 30, hour: 9, minute: 0 }, "America/New_York"), Date.UTC(2026, 9, 30, 13, 0));
  assert.equal(fromLocal({ year: 2026, month: 11, day: 2, hour: 9, minute: 0 }, "America/New_York"), Date.UTC(2026, 10, 2, 14, 0));
});

test("wall times skipped by a DST jump do not exist", () => {
  // US clocks jump from 02:00 to 03:00 on 8 Mar 2026.
  assert.equal(fromLocal({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, "America/New_York"), null);
});

test("repeated wall times resolve to the earlier instant", () => {
  // 01:30 happens twice on 1 Nov 2026 in New York; the first is EDT (UTC-4).
  assert.equal(fromLocal({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, "America/New_York"), Date.UTC(2026, 10, 1, 5, 30));
});

test("toLocal round-trips", () => {
  const instant = Date.UTC(2026, 5, 15, 23, 45);
  const local = toLocal(instant, "Europe/London");
  assert.deepEqual({ ...local, second: 0 }, { year: 2026, month: 6, day: 16, hour: 0, minute: 45, second: 0 });
});

test("date helpers", () => {
  assert.deepEqual(addDays({ year: 2026, month: 12, day: 31 }, 1), { year: 2027, month: 1, day: 1 });
  assert.equal(isoWeekday({ year: 2026, month: 9, day: 17 }), 4); // Thursday
  assert.equal(isoWeekday({ year: 2026, month: 9, day: 20 }), 7); // Sunday
  assert.equal(parseDate("2026-02-30"), null);
  assert.deepEqual(parseDate("2026-02-28"), { year: 2026, month: 2, day: 28 });
  assert.equal(parseTimeOfDay("09:30"), 570);
  assert.equal(parseTimeOfDay("24:00"), 1440);
  assert.equal(parseTimeOfDay("25:00"), null);
});
