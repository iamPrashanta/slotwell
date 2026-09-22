"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, LayoutGrid, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/event-types", label: "Meeting types", icon: LayoutGrid },
  { href: "/dashboard/availability", label: "Availability", icon: Clock },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  if (variant === "bottom") {
    return (
      <nav aria-label="Dashboard" data-overlay-edge="bottom" className="fixed inset-x-0 bottom-0 z-(--z-sticky) pb-[env(safe-area-inset-bottom)] grid grid-cols-4 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", isActive(href) ? "text-accent" : "text-muted")}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
            isActive(href) ? "bg-accent-soft font-medium text-foreground" : "text-muted hover:bg-surface-muted hover:text-foreground",
          )}
        >
          <Icon className={cn("h-4 w-4", isActive(href) && "text-accent")} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
