import type { Metadata } from "next";
import { connection } from "next/server";
import { Lock, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/admin/ui";
import { RegenerateBackupCodes } from "@/components/admin/regenerate-codes";
import { lockAdmin } from "@/app/admin/login/actions";
import { backupCodesLeft, requireAdmin } from "@/server/admin-auth";

export const metadata: Metadata = { title: "Security" };

export default async function AdminSecurityPage() {
  const session = await requireAdmin();
  await connection();
  const left = await backupCodesLeft(session.user.id);
  return (
    <>
      <PageHeader title="Security" description="Your admin sign-in protection." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Two-factor sign-in">
          <div className="flex items-start gap-3 px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><ShieldCheck className="h-4 w-4" aria-hidden /></span>
            <div className="text-sm">
              <p className="font-medium">Authenticator app is on</p>
              <p className="mt-1 text-muted">
                Every admin sign-in needs a 6-digit code. Admin access lasts 8 hours, then asks again.
                You have <strong className={left <= 3 ? "text-danger" : "text-foreground"}>{left}</strong> unused backup code{left === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
          <div className="px-2 pb-2 pt-3"><RegenerateBackupCodes /></div>
        </Panel>
        <Panel title="Session">
          <div className="px-2 py-2 text-sm text-muted">
            <p>Signed in as <span className="text-foreground">{session.user.email}</span>.</p>
            <p className="mt-1">Locking ends admin access on this device but keeps you signed in to your own dashboard.</p>
            <form action={lockAdmin} className="mt-4">
              <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 text-sm font-medium text-amber-500 hover:border-amber-500/70">
                <Lock className="h-4 w-4" aria-hidden /> Lock admin now
              </button>
            </form>
          </div>
        </Panel>
      </div>
    </>
  );
}
