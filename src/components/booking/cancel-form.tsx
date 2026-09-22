"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CancelForm({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Cancel booking
      </Button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-3 animate-fade-up"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
        const res = await fetch(`/api/bookings/${encodeURIComponent(token)}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }).catch(() => null);
        const body = await res?.json().catch(() => ({}));
        if (!res?.ok) {
          setError(body?.error ?? "Could not cancel. Please try again.");
          setPending(false);
          return;
        }
        router.refresh();
      }}
    >
      <label className="flex flex-col gap-2 text-sm font-medium">
        Reason (optional)
        <textarea
          name="reason"
          rows={3}
          maxLength={500}
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-accent"
        />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="bg-danger">
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
          Yes, cancel it
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Keep it
        </Button>
      </div>
    </form>
  );
}
