"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function GoogleSignIn({ callbackURL = "/dashboard" }: { callbackURL?: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await authClient.signIn.social({ provider: "google", callbackURL });
          if (result?.error) {
            setError(result.error.message ?? "Sign-in failed.");
            setPending(false);
          }
        }}
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
        Continue with Google
      </Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function SignOutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const Icon = pending ? LoaderCircle : LogOut;
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={compact ? "Sign out" : undefined}
      title="Sign out"
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium text-muted transition outline-none hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60",
        compact ? "h-9 w-9 border border-border hover:border-danger/40" : "h-9 px-3",
        className,
      )}
    >
      <Icon className={cn("h-4 w-4", pending && "animate-spin")} aria-hidden />
      {!compact && "Sign out"}
    </button>
  );
}

/** Local demo only (DEV_PASSWORD_LOGIN=true): email + password sign-in and sign-up. */
export function DevPasswordSignIn({ defaultEmail, callbackURL = "/dashboard", allowSignUp = true }: { defaultEmail?: string; callbackURL?: string; allowSignUp?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"in" | "up">("in");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const field = "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const email = String(form.get("email"));
        const password = String(form.get("password"));
        setPending(true);
        setError("");
        const result =
          mode === "up"
            ? await authClient.signUp.email({ email, password, name: String(form.get("name") ?? ""), callbackURL })
            : await authClient.signIn.email({ email, password, callbackURL });
        if (result?.error) {
          setError(result.error.message ?? "Sign-in failed.");
          setPending(false);
        } else {
          router.push(callbackURL);
          router.refresh();
        }
      }}
    >
      {mode === "up" && <input name="name" required maxLength={80} autoComplete="name" aria-label="Your name" placeholder="Your name" className={field} />}
      <input name="email" type="email" required defaultValue={defaultEmail} autoComplete="email" aria-label="Email" placeholder="Email" className={field} />
      <input name="password" type="password" required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} aria-label="Password" placeholder="Password" className={field} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
        {mode === "up" ? "Create account" : "Sign in"}
      </Button>
      {allowSignUp && (
        <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); }} className="text-sm text-muted hover:text-foreground">
          {mode === "in" ? "No account? Create one" : "Already have an account? Sign in"}
        </button>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
