"use client";

import * as React from "react";
import { Ban, LoaderCircle, LogOut, ShieldCheck, ShieldOff, Undo2 } from "lucide-react";
import { banUser, revokeSessions, setUserRole, unbanUser, type AdminResult } from "@/app/admin/(panel)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type User = { id: string; name: string; banned: boolean; role: "user" | "admin"; upcoming: number };
type Confirm = null | "ban" | "unban" | "revoke" | "grant" | "remove";

export function UserActions({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [result, setResult] = React.useState<AdminResult | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (isSelf) return <p className="px-2 py-2 text-sm text-muted">This is your account. Admin actions can&apos;t target yourself.</p>;

  const run = (fn: () => Promise<AdminResult>) =>
    startTransition(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) setConfirm(null);
    });

  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-surface-muted disabled:opacity-50";

  return (
    <div className="flex flex-col gap-1">
      {!confirm && (
        <>
          {user.banned ? (
            <button className={row} onClick={() => setConfirm("unban")}><Undo2 className="h-4 w-4 text-emerald-500" aria-hidden /> Lift suspension</button>
          ) : (
            <button className={cn(row, "text-danger hover:bg-danger/10")} onClick={() => setConfirm("ban")}><Ban className="h-4 w-4" aria-hidden /> Suspend account</button>
          )}
          <button className={row} onClick={() => setConfirm("revoke")}><LogOut className="h-4 w-4 text-muted" aria-hidden /> Sign out everywhere</button>
          {!user.banned && (user.role === "admin" ? (
            <button className={row} onClick={() => setConfirm("remove")}><ShieldOff className="h-4 w-4 text-amber-500" aria-hidden /> Remove admin access</button>
          ) : (
            <button className={row} onClick={() => setConfirm("grant")}><ShieldCheck className="h-4 w-4 text-amber-500" aria-hidden /> Make admin</button>
          ))}
        </>
      )}

      {confirm === "ban" && (
        <form
          className="rounded-2xl border border-danger/30 bg-danger/5 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => banUser(user.id, String(f.get("reason") ?? ""), f.get("cancel") === "on"));
          }}
        >
          <p className="text-sm font-medium">Suspend {user.name}?</p>
          <p className="mt-1 text-xs text-muted">They&apos;re signed out, can&apos;t sign in and their booking pages stop working.</p>
          <textarea name="reason" rows={2} maxLength={500} placeholder="Reason (internal, optional)"
            className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-danger/60" />
          {user.upcoming > 0 && (
            <label className="mt-2 flex items-start gap-2 text-xs">
              <input type="checkbox" name="cancel" className="mt-0.5 accent-[var(--danger)]" />
              Also cancel their {user.upcoming} upcoming booking(s) and email the guests
            </label>
          )}
          <Actions pending={pending} onCancel={() => setConfirm(null)} label="Suspend" danger />
        </form>
      )}

      {confirm && confirm !== "ban" && (
        <div className="rounded-2xl border border-border bg-background/60 p-3">
          <p className="text-sm font-medium">
            {{ unban: `Lift suspension for ${user.name}?`, revoke: `Sign ${user.name} out of every device?`, grant: `Give ${user.name} admin access?`, remove: `Remove admin access from ${user.name}?` }[confirm]}
          </p>
          {confirm === "grant" && <p className="mt-1 text-xs text-muted">They can see every user and booking. They must set up 2FA before entering the admin panel.</p>}
          <Actions
            pending={pending}
            onCancel={() => setConfirm(null)}
            label={{ unban: "Lift suspension", revoke: "Sign out", grant: "Make admin", remove: "Remove admin" }[confirm]}
            onConfirm={() =>
              run(() =>
                confirm === "unban" ? unbanUser(user.id) : confirm === "revoke" ? revokeSessions(user.id) : setUserRole(user.id, confirm === "grant" ? "admin" : "user"),
              )
            }
          />
        </div>
      )}

      {result && (
        <p role="status" className={cn("mt-2 px-2 text-sm", result.ok ? "text-emerald-500" : "text-danger")}>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}

function Actions({ pending, onCancel, onConfirm, label, danger }: { pending: boolean; onCancel: () => void; onConfirm?: () => void; label: string; danger?: boolean }) {
  return (
    <div className="mt-3 flex justify-end gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
      <Button type={onConfirm ? "button" : "submit"} size="sm" variant={danger ? "dangerSolid" : "primary"} disabled={pending} onClick={onConfirm}>
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} {label}
      </Button>
    </div>
  );
}
