import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { SignOutButton } from "@/components/auth/google-sign-in";
import { requireUser } from "@/server/session";
import { appConfig } from "@/server/config";
import { suggestUsername } from "@/lib/usernames";

export const metadata: Metadata = { title: "Set up your page", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const session = await requireUser();
  if (session.onboarded) redirect("/dashboard");
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 py-6">
        <Logo />
        <SignOutButton />
      </header>
      <div className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 animate-fade-up">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Welcome</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Set up your booking page</h1>
        <p className="mt-3 text-muted">
          Pick the link people will use to book you. We&apos;ll add weekday hours and a 30-minute meeting type — you can
          change everything later.
        </p>
        <OnboardingForm
          appUrl={appConfig.appUrl}
          initial={{ displayName: session.user.name ?? "", username: suggestUsername(session.user.email) }}
        />
      </div>
    </main>
  );
}
