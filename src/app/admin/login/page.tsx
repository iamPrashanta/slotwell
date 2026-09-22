import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { DevPasswordSignIn, GoogleSignIn, SignOutButton } from "@/components/auth/google-sign-in";
import { AdminSetup, AdminVerify } from "@/components/admin/two-factor";
import { devPasswordLogin } from "@server/auth.mjs";
import { getAdminGate } from "@/server/admin-auth";
import { appConfig } from "@/server/config";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const gate = await getAdminGate();
  if (gate.stage === "ok") redirect("/admin");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-card border border-amber-500/25 bg-surface p-8 shadow-2xl shadow-black/30 animate-fade-up">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Admin
          </span>
        </div>

        {gate.stage === "signin" && (
          <>
            <h1 className="text-xl font-semibold">Admin sign-in</h1>
            <p className="mb-8 mt-2 text-sm text-muted">Step 1 of 2 — sign in with your admin account. You&apos;ll confirm with your authenticator app next.</p>
            <div className="flex flex-col gap-6">
              {appConfig.googleConfigured && <GoogleSignIn callbackURL="/admin/login" />}
              {devPasswordLogin && <DevPasswordSignIn callbackURL="/admin/login" allowSignUp={false} />}
            </div>
          </>
        )}

        {gate.stage === "forbidden" && (
          <>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-danger/10 text-danger">
              <ShieldAlert className="h-5 w-5" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold">No admin access</h1>
            <p className="mt-2 text-sm text-muted">
              <span className="text-foreground">{gate.email}</span> isn&apos;t an admin account.
            </p>
            <div className="mt-8 flex items-center justify-between">
              <Link href="/dashboard" className="text-sm text-accent hover:underline">Go to my dashboard</Link>
              <SignOutButton />
            </div>
          </>
        )}

        {gate.stage === "setup" && <AdminSetup email={gate.email} secret={gate.secret} qrSvg={gate.qrSvg} />}
        {gate.stage === "verify" && <AdminVerify email={gate.email} />}
      </div>
    </main>
  );
}
