"use client";

import * as React from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { regenerateBackupCodes } from "@/app/admin/(panel)/actions";
import { BackupCodes } from "@/components/admin/two-factor";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function RegenerateBackupCodes() {
  const [open, setOpen] = React.useState(false);
  const [codes, setCodes] = React.useState<string[] | null>(null);
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  if (codes) return <BackupCodes codes={codes} />;
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <RefreshCw className="h-4 w-4" aria-hidden /> New backup codes
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get("code") ?? "");
        startTransition(async () => {
          const r = await regenerateBackupCodes(code);
          if (r.ok) setCodes(r.codes);
          else setError(r.error);
        });
      }}
    >
      <label className="text-sm text-muted">Confirm with a code from your authenticator app. Old backup codes stop working.</label>
      <div className="flex gap-2">
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123 456"
          className={cn(inputClass, "max-w-40 text-center font-mono tracking-widest")} />
        <Button type="submit" size="sm" className="h-auto" disabled={pending}>
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Generate
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
