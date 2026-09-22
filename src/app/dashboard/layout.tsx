import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/google-sign-in";
import { DashboardNav } from "@/components/dashboard/nav";
import { requireOwner } from "@/server/session";
import { getOwnerById } from "@/server/data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOwner();
  const owner = await getOwnerById(session.user.id);
  const name = owner?.displayName || session.user.name || "Owner";
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <Link href="/dashboard" className="mb-8 px-3">
          <Logo />
        </Link>
        <DashboardNav variant="side" />
        <div className="mt-auto flex flex-col gap-3">
          {session.role === "admin" && (
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm font-medium text-amber-500 transition hover:border-amber-500/60"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden /> Admin panel
            </Link>
          )}
          {owner && (
            <Link
              href={`/${owner.username}`}
              target="_blank"
              className="group flex items-center justify-between gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2.5 text-sm transition hover:border-accent/60"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">Your booking page</span>
                <span className="truncate text-xs text-muted">/{owner.username}</span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted transition group-hover:text-accent" aria-hidden />
            </Link>
          )}
          <div className="flex items-center gap-3 rounded-2xl bg-surface-muted/60 p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent" aria-hidden>
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted" title={session.user.email}>{session.user.email}</p>
            </div>
            <SignOutButton compact />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header data-overlay-edge="top" className="sticky top-0 z-(--z-sticky) flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden">
          <Logo />
          <SignOutButton compact />
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">{children}</main>
      </div>
      <DashboardNav variant="bottom" />
    </div>
  );
}
