import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { lockAdmin } from "@/app/admin/login/actions";
import { requireAdmin } from "@/server/admin-auth";

export const metadata = { title: { default: "Admin", template: "%s · Slotwell admin" }, robots: { index: false, follow: false } };

function AdminBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-500">
      <ShieldCheck className="h-3 w-3" aria-hidden /> Admin
    </span>
  );
}

function LockButton({ compact }: { compact?: boolean }) {
  return (
    <form action={lockAdmin}>
      <button
        type="submit"
        title="Lock admin (keeps you signed in to your dashboard)"
        aria-label={compact ? "Lock admin" : undefined}
        className={
          compact
            ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:border-amber-500/50 hover:text-amber-500"
            : "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted transition hover:bg-amber-500/10 hover:text-amber-500"
        }
      >
        <Lock className="h-4 w-4" aria-hidden /> {!compact && "Lock admin"}
      </button>
    </form>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-3">
          <Link href="/admin"><Logo /></Link>
          <AdminBadge />
        </div>
        <AdminNav variant="side" />
        <div className="mt-auto flex flex-col gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2.5 text-sm transition hover:border-accent/60">
            <ArrowLeft className="h-4 w-4 text-muted" aria-hidden /> My dashboard
          </Link>
          <div className="flex items-center gap-3 rounded-2xl bg-surface-muted/60 p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{session.user.name || "Admin"}</p>
              <p className="truncate text-xs text-muted">{session.user.email}</p>
            </div>
            <LockButton compact />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header data-overlay-edge="top" className="sticky top-0 z-(--z-sticky) border-b border-border bg-background/85 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><Logo /><AdminBadge /></span>
            <span className="flex items-center gap-2">
              <Link href="/dashboard" aria-label="My dashboard" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted hover:text-foreground">
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Link>
              <LockButton compact />
            </span>
          </div>
          <AdminNav variant="top" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 md:px-8 md:pt-10">{children}</main>
      </div>
    </div>
  );
}
