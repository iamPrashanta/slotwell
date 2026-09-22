"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, Download, KeyRound, LoaderCircle } from "lucide-react";
import { confirmAdminSetup, verifyAdminLogin } from "@/app/admin/login/actions";
import { SignOutButton } from "@/components/auth/google-sign-in";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { cn } from "@/lib/utils";

function CodeInput({ backup, disabled }: { backup?: boolean; disabled?: boolean }) {
  return (
    <input
      name="code"
      required
      disabled={disabled}
      autoFocus
      autoComplete="one-time-code"
      inputMode={backup ? "text" : "numeric"}
      pattern={backup ? "[A-Za-z0-9-]{9,12}" : "[0-9 ]{6,7}"}
      maxLength={backup ? 12 : 7}
      placeholder={backup ? "xxxx-xxxx" : "123 456"}
      aria-label={backup ? "Backup code" : "6-digit code"}
      className={cn(inputClass, "text-center font-mono text-2xl tracking-[0.35em]")}
    />
  );
}

export function AdminVerify({ email }: { email: string }) {
  const [backup, setBackup] = React.useState(false);
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get("code") ?? "");
        setError("");
        startTransition(async () => {
          const r = await verifyAdminLogin(code);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <h1 className="text-xl font-semibold">Two-factor check</h1>
      <p className="mb-6 mt-2 text-sm text-muted">
        Step 2 of 2 — {backup ? "enter one of your backup codes" : "enter the 6-digit code from your authenticator app"} for{" "}
        <span className="text-foreground">{email}</span>.
      </p>
      <CodeInput key={String(backup)} backup={backup} disabled={pending} />
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={pending} className="mt-4 w-full">
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Verify
      </Button>
      <div className="mt-6 flex items-center justify-between text-sm">
        <button type="button" onClick={() => { setBackup(!backup); setError(""); }} className="inline-flex items-center gap-1.5 text-muted hover:text-foreground">
          <KeyRound className="h-4 w-4" aria-hidden /> {backup ? "Use authenticator code" : "Use a backup code"}
        </button>
        <SignOutButton />
      </div>
    </form>
  );
}

export function AdminSetup({ email, secret, qrSvg }: { email: string; secret: string; qrSvg: string }) {
  const router = useRouter();
  const [codes, setCodes] = React.useState<string[] | null>(null);
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  if (codes) return <BackupCodes codes={codes} onDone={() => router.push("/admin")} />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get("code") ?? "");
        setError("");
        startTransition(async () => {
          const r = await confirmAdminSetup(code);
          if (r.ok) setCodes(r.backupCodes);
          else setError(r.error);
        });
      }}
    >
      <h1 className="text-xl font-semibold">Turn on two-factor sign-in</h1>
      <p className="mt-2 text-sm text-muted">
        The admin panel needs a second step for <span className="text-foreground">{email}</span>. Scan this with Google
        Authenticator, 1Password, Authy or any authenticator app.
      </p>
      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* QR is generated server-side from our own otpauth URI. */}
        <div className="h-40 w-40 shrink-0 rounded-2xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" aria-label="QR code for your authenticator app" role="img"
          dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="min-w-0 text-sm">
          <p className="text-muted">Can&apos;t scan? Enter this key:</p>
          <p className="mt-2 break-all rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs tracking-wider">
            {secret.match(/.{1,4}/g)?.join(" ")}
          </p>
        </div>
      </div>
      <label className="mt-6 block text-sm font-medium">Enter the 6-digit code it shows</label>
      <div className="mt-2"><CodeInput disabled={pending} /></div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={pending} className="mt-4 w-full">
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Turn on 2FA
      </Button>
    </form>
  );
}

export function BackupCodes({ codes, onDone, doneLabel = "Continue to admin" }: { codes: string[]; onDone?: () => void; doneLabel?: string }) {
  const [copied, setCopied] = React.useState(false);
  const text = `Slotwell admin backup codes (each works once)\n\n${codes.join("\n")}\n`;
  return (
    <div>
      <h2 className="text-xl font-semibold">Save your backup codes</h2>
      <p className="mt-2 text-sm text-muted">
        If you lose your phone, each code gets you in once. They won&apos;t be shown again — keep them in a password manager.
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background p-4 font-mono text-sm">
        {codes.map((c) => <li key={c} className="text-center">{c}</li>)}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => {});
          setCopied(true);
        }}>
          {copied ? <Check className="h-4 w-4 text-accent" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copied" : "Copy"}
        </Button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
          download="slotwell-admin-backup-codes.txt"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:border-accent/60"
        >
          <Download className="h-4 w-4" aria-hidden /> Download
        </a>
      </div>
      {onDone && (
        <Button type="button" size="lg" className="mt-6 w-full" onClick={onDone}>
          {doneLabel} <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
