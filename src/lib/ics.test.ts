import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, foldLine, icsDate, icsEscape } from "./ics.ts";

const base = {
  uid: "abc@slotwell.app",
  sequence: 0,
  start: new Date("2026-09-21T04:30:00Z"),
  end: new Date("2026-09-21T05:00:00Z"),
  summary: "Intro call: Ana, Prashanta",
  organizer: { name: "Prashanta Mondal", email: "owner@example.com" },
  attendee: { name: "Ana \"A\" Lee", email: "ana@example.com" },
  stamp: new Date("2026-09-20T00:00:00Z"),
};

test("dates are UTC basic format", () => {
  assert.equal(icsDate(new Date("2026-09-21T04:30:00.000Z")), "20260921T043000Z");
});

test("text values are escaped", () => {
  assert.equal(icsEscape("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
});

test("long lines are folded at 75 octets with CRLF + space", () => {
  const folded = foldLine("X".repeat(160));
  const parts = folded.split("\r\n");
  assert.equal(parts[0].length, 75);
  assert.ok(parts.slice(1).every((p) => p.startsWith(" ") && Buffer.byteLength(p) <= 75));
  assert.equal(folded.replace(/\r\n /g, ""), "X".repeat(160));
});

test("folding never splits a multi-byte character", () => {
  const folded = foldLine("é".repeat(100));
  for (const part of folded.split("\r\n")) assert.ok(Buffer.byteLength(part) <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), "é".repeat(100));
});

test("REQUEST invite has the required fields and CRLF endings", () => {
  const ics = buildIcs({ ...base, method: "REQUEST", location: "https://meet.google.com/abc-defg-hij" });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nMETHOD:REQUEST\r\n/);
  assert.match(ics, /\r\nUID:abc@slotwell\.app\r\n/);
  assert.match(ics, /\r\nDTSTART:20260921T043000Z\r\n/);
  assert.match(ics, /\r\nSUMMARY:Intro call: Ana\\, Prashanta\r\n/);
  assert.match(ics, /\r\nSTATUS:CONFIRMED\r\n/);
  assert.match(ics, /ATTENDEE;CN="Ana A Lee"/);
  assert.ok(!/[^\r]\n/.test(ics), "all line breaks are CRLF");
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("CANCEL invite keeps the UID and marks the event cancelled", () => {
  const ics = buildIcs({ ...base, method: "CANCEL", sequence: 2 });
  assert.match(ics, /\r\nMETHOD:CANCEL\r\n/);
  assert.match(ics, /\r\nSEQUENCE:2\r\n/);
  assert.match(ics, /\r\nSTATUS:CANCELLED\r\n/);
  assert.ok(!ics.includes("VALARM"));
});
