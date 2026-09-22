// End-to-end check of sign-up, onboarding guard, admin 2FA and admin actions against a RUNNING app.
// Local demo only (needs DEV_PASSWORD_LOGIN=true). Creates throwaway accounts *@e2e.test and removes them.
// Usage (inside the app container): podman exec -i slotwell-app-1 node --input-type=module - < scripts/admin-e2e.mjs
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

// Must match BETTER_AUTH_URL: Better Auth rejects requests from other origins.
const BASE = (process.env.E2E_URL ?? process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3004").replace(/\/$/, "");
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

// Server Action ids from the build manifest.
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const action = Object.fromEntries(Object.entries(manifest).map(([id, v]) => [v.exportedName, id]));

class Client {
  jar = new Map();
  async req(path, init = {}) {
    const headers = { Origin: BASE, ...(init.headers ?? {}) };
    if (this.jar.size) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";");
      const [k, ...v] = pair.split("=");
      const expired = attrs.some((a) => /max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
      if (expired || v.join("=") === "") this.jar.delete(k.trim());
      else this.jar.set(k.trim(), v.join("="));
    }
    return res;
  }
  json(path, body) {
    return this.req(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async act(path, name, args) {
    const res = await this.req(path, {
      method: "POST",
      headers: { "Next-Action": action[name], Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(args),
    });
    return { status: res.status, redirect: res.headers.get("x-action-redirect") ?? "", text: await res.text() };
  }
  async get(path) {
    const res = await this.req(path);
    return { status: res.status, location: res.headers.get("location") ?? "", text: res.status === 200 ? await res.text() : "" };
  }
}

function totp(secret, offset = 0) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0; const out = [];
  for (const ch of secret) { value = (value << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = createHmac("sha1", Buffer.from(out)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}

const stamp = Date.now();
const adminEmail = `admin-${stamp}@e2e.test`;
const userEmail = `user-${stamp}@e2e.test`;
const password = `e2e-${stamp}-pass`;

try {
  // --- Anonymous guards
  const anon = new Client();
  check("anon /admin → /admin/login", (await anon.get("/admin")).location.endsWith("/admin/login"));
  check("anon /dashboard → /login", (await anon.get("/dashboard")).location.endsWith("/login"));

  // --- Normal user: sign-up → onboarding
  const user = new Client();
  check("sign-up works", (await user.json("/api/auth/sign-up/email", { email: userEmail, password, name: "E2E User" })).ok);
  check("new user /dashboard → /onboarding", (await user.get("/dashboard")).location.endsWith("/onboarding"));
  const onboard = await user.act("/onboarding", "completeOnboarding", [{ displayName: "E2E User", username: `e2e-${stamp}`, timeZone: "Europe/London" }]);
  check("onboarding completes", onboard.redirect.startsWith("/dashboard"), onboard.redirect || onboard.text.slice(0, 80));
  check("booking page is live", (await anon.get(`/e2e-${stamp}`)).status === 200);
  check("reserved username rejected", (await user.act("/dashboard/settings", "saveProfile", [{ displayName: "x", username: "admin", bio: "" }])).text.includes("reserved"));
  const nonAdmin = await user.get("/admin/login");
  check("non-admin sees 'No admin access'", nonAdmin.text.includes("No admin access"));
  const sneaky = await user.act("/admin/users/x", "banUser", ["x", "", false]);
  check("non-admin can't call admin actions", sneaky.redirect.startsWith("/admin/login"));

  // --- Admin: sign-in, 2FA setup, codes
  const { rows: [u] } = await db.query(`SELECT id FROM "user" WHERE email = $1`, [userEmail]);
  await new Client().json("/api/auth/sign-up/email", { email: adminEmail, password, name: "E2E Admin" });
  await db.query(`UPDATE "user" SET role = 'admin' WHERE email = $1`, [adminEmail]);
  const admin = new Client();
  check("admin password sign-in", (await admin.json("/api/auth/sign-in/email", { email: adminEmail, password })).ok);
  check("admin without 2FA → /admin/login", (await admin.get("/admin")).location.endsWith("/admin/login"));
  const setupPage = await admin.get("/admin/login");
  const secret = (setupPage.text.match(/[A-Z2-7]{4}(?: [A-Z2-7]{1,4}){7}/)?.[0] ?? "").replaceAll(" ", "");
  check("setup page shows QR + secret", setupPage.text.includes("<svg") && secret.length === 32);
  check("wrong setup code rejected", (await admin.act("/admin/login", "confirmAdminSetup", ["000000"])).text.includes("didn"));
  const setup = await admin.act("/admin/login", "confirmAdminSetup", [totp(secret)]);
  const codes = setup.text.match(/"backupCodes":\[([^\]]*)\]/)?.[1].match(/[a-z2-9]{4}-[a-z2-9]{4}/g) ?? [];
  check("2FA enabled + 10 backup codes", codes.length === 10, `${codes.length}`);
  for (const p of ["/admin", "/admin/users", `/admin/users/${u.id}`, "/admin/bookings", "/admin/audit", "/admin/security"]) {
    check(`admin page ${p}`, (await admin.get(p)).status === 200);
  }

  // Forged / stale cookie
  const forged = new Client(); forged.jar = new Map(admin.jar); forged.jar.set("sw_admin", `${Date.now() + 1e7}.forged`);
  check("forged admin cookie rejected", (await forged.get("/admin")).status === 307);

  // Lock → replay → backup code
  await admin.act("/admin/security", "lockAdmin", []);
  check("lock ends admin access", (await admin.get("/admin")).status === 307);
  check("replayed TOTP rejected", !(await admin.act("/admin/login", "verifyAdminLogin", [totp(secret)])).redirect);
  check("backup code works once", (await admin.act("/admin/login", "verifyAdminLogin", [codes[0].toUpperCase()])).redirect.startsWith("/admin"));
  await admin.act("/admin/security", "lockAdmin", []);
  check("used backup code rejected", !(await admin.act("/admin/login", "verifyAdminLogin", [codes[0]])).redirect);
  check("next TOTP window works", (await admin.act("/admin/login", "verifyAdminLogin", [totp(secret, 1)])).redirect.startsWith("/admin"));

  // --- Admin actions
  const { rows: [a] } = await db.query(`SELECT id FROM "user" WHERE email = $1`, [adminEmail]);
  check("self-suspend blocked", (await admin.act(`/admin/users/${a.id}`, "banUser", [a.id, "", false])).text.includes("own account"));
  check("suspend user", (await admin.act(`/admin/users/${u.id}`, "banUser", [u.id, "e2e", false])).text.includes("Suspended"));
  check("suspended user signed out", (await user.get("/dashboard")).location.includes("/login"));
  check("suspended user can't sign in", !(await new Client().json("/api/auth/sign-in/email", { email: userEmail, password })).ok);
  check("suspended booking page 404", (await anon.get(`/e2e-${stamp}`)).status === 404);
  check("lift suspension", (await admin.act(`/admin/users/${u.id}`, "unbanUser", [u.id])).text.includes("lifted"));
  check("user can sign in again", (await new Client().json("/api/auth/sign-in/email", { email: userEmail, password })).ok);
  check("grant admin", (await admin.act(`/admin/users/${u.id}`, "setUserRole", [u.id, "admin"])).text.includes("granted"));
  check("remove admin", (await admin.act(`/admin/users/${u.id}`, "setUserRole", [u.id, "user"])).text.includes("removed"));
  // Brute force: 5 wrong codes lock the account's 2FA for 10 minutes, even for a correct code.
  await admin.act("/admin/security", "lockAdmin", []);
  for (let i = 0; i < 5; i++) await admin.act("/admin/login", "verifyAdminLogin", ["000000"]);
  check("2FA brute force blocked", (await admin.act("/admin/login", "verifyAdminLogin", [totp(secret)])).text.includes("Too many attempts"));
  const { rows: log } = await db.query(`SELECT count(*)::int AS n FROM admin_audit_log WHERE admin_id = $1`, [a.id]);
  check("actions written to audit log", log[0].n >= 8, `${log[0].n} entries`);
} catch (error) {
  check("script crashed", false, error instanceof Error ? error.stack : String(error));
} finally {
  const { rows } = await db.query(`SELECT id FROM "user" WHERE email LIKE '%@e2e.test'`);
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await db.query(`DELETE FROM admin_audit_log WHERE admin_id = ANY($1) OR target_id = ANY($1)`, [ids]);
    await db.query(`DELETE FROM bookings WHERE owner_id = ANY($1)`, [ids]);
    await db.query(`DELETE FROM "user" WHERE id = ANY($1)`, [ids]);
  }
  await db.end();
  const failed = results.filter((r) => !r).length;
  console.log(failed ? `\n${failed} FAILED of ${results.length}` : `\nALL ${results.length} CHECKS PASSED`);
  process.exitCode = failed ? 1 : 0;
}
