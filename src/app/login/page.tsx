import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { DevPasswordSignIn, GoogleSignIn } from "@/components/auth/google-sign-in";
import { devPasswordLogin } from "@server/auth.mjs";
import { getSession } from "@/server/session";
import { appConfig } from "@/server/config";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  suspended: "This account is suspended. Contact support if you think this is a mistake.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await getSession();
  if (session && !error) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-8 animate-fade-up">
        <Logo className="mb-8" />
        <h1 className="text-xl font-semibold">Sign in to Slotwell</h1>
        <p className="mb-8 mt-2 text-sm text-muted">
          New here? Signing in creates your free account. It also connects your Google Calendar, so Slotwell can
          check busy times and add bookings.
        </p>
        {error && ERRORS[error] && (
          <p role="alert" className="-mt-4 mb-6 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{ERRORS[error]}</p>
        )}
        <div className="flex flex-col gap-6">
          {appConfig.googleConfigured ? (
            <GoogleSignIn />
          ) : (
            !devPasswordLogin && (
              <p className="text-sm text-danger">Google sign-in isn&apos;t configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.</p>
            )
          )}
          {devPasswordLogin && (
            <div className="flex flex-col gap-3">
              {appConfig.googleConfigured && <p className="text-center text-xs uppercase tracking-widest text-muted">or demo sign-in</p>}
              <DevPasswordSignIn />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
