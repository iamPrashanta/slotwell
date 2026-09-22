"use client";

import * as React from "react";
import { LoaderCircle, XCircle } from "lucide-react";
import { adminCancelBooking } from "@/app/admin/(panel)/actions";
import { Button } from "@/components/ui/button";

export function AdminCancelBooking({ id, guest }: { id: string; guest: string }) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  if (!open) {
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} aria-label={`Cancel booking with ${guest}`}>
        <XCircle className="h-4 w-4" aria-hidden /> Cancel
      </Button>
    );
  }
  return (
    <form
      className="mt-2 flex w-full basis-full flex-col gap-2 rounded-2xl border border-danger/30 bg-danger/5 p-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
        startTransition(async () => {
          const r = await adminCancelBooking(id, reason);
          if (!r.ok) setError(r.error);
        });
      }}
    >
      <input name="reason" maxLength={500} autoFocus placeholder={`Message to ${guest} (optional)`}
        className="h-9 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-danger/60" />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>Keep</Button>
        <Button type="submit" variant="dangerSolid" size="sm" disabled={pending}>
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Cancel &amp; notify
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
