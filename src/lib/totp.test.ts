import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, base32Encode, generateTotpSecret, hotp, verifyTotp } from "./totp.ts";

// RFC 6238 Appendix B (SHA-1 seed "12345678901234567890"), 8-digit vectors.
const seed = Buffer.from("12345678901234567890");
const vectors: Array<[number, string]> = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
];

test("hotp matches RFC 6238 vectors", () => {
  for (const [t, code] of vectors) assert.equal(hotp(seed, Math.floor(t / 30), 8), code);
});

test("base32 round-trips", () => {
  const s = generateTotpSecret();
  assert.equal(s.length, 32);
  assert.equal(base32Encode(base32Decode(s)), s);
});

test("verifyTotp accepts ±1 step and rejects replays and junk", () => {
  const secret = base32Encode(seed);
  const now = 1111111111 * 1000;
  const step = Math.floor(now / 30000);
  const code = hotp(seed, step);
  assert.equal(verifyTotp(secret, code, { nowMs: now }), step);
  assert.equal(verifyTotp(secret, hotp(seed, step - 1), { nowMs: now }), step - 1);
  assert.equal(verifyTotp(secret, hotp(seed, step - 2), { nowMs: now }), null);
  assert.equal(verifyTotp(secret, code, { nowMs: now, lastStep: step }), null);
  assert.equal(verifyTotp(secret, "12ab56", { nowMs: now }), null);
  assert.equal(verifyTotp(secret, "123 456".replace(" ", ""), { nowMs: now }) === step, code === "123456");
});
