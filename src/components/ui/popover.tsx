"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const GAP = 8;

/**
 * Space the popover may use: the viewport minus any visible sticky/fixed chrome marked with
 * data-overlay-edge="top" | "bottom" (dashboard header, phone bottom nav).
 */
function safeArea() {
  let top = GAP;
  let bottom = window.innerHeight - GAP;
  document.querySelectorAll<HTMLElement>("[data-overlay-edge]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return; // hidden at this breakpoint
    if (el.dataset.overlayEdge === "top") top = Math.max(top, r.bottom + GAP);
    else bottom = Math.min(bottom, r.top - GAP);
  });
  return { top, bottom };
}

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The element the popover is attached to. */
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: "start" | "end";
  id?: string;
  role?: React.AriaRole;
  className?: string;
  children: React.ReactNode;
};

/**
 * Floating panel rendered in a portal on <body> with position: fixed.
 * - Never clipped by overflow/transform on ancestors and never hidden behind sticky chrome.
 * - Opens below the anchor, flips above when there is more room there, and scrolls inside if needed.
 * - Closes on outside click, Escape (focus returns to the anchor) and when the anchor scrolls out of view.
 */
export function Popover({ open, onClose, anchorRef, align = "start", id, role = "dialog", className, children }: PopoverProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  const place = React.useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const { top: minY, bottom: maxY } = safeArea();

    // Anchor scrolled under the header/nav or off screen: close instead of floating detached.
    if (a.bottom < minY - GAP || a.top > maxY + GAP) {
      onClose();
      return;
    }

    const spaceBelow = maxY - a.bottom - GAP;
    const spaceAbove = a.top - minY - GAP;
    const natural = panel.scrollHeight;
    const above = natural > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, above ? spaceAbove : spaceBelow);
    const height = Math.min(natural, maxHeight);

    const width = panel.offsetWidth;
    const vw = document.documentElement.clientWidth;
    let left = align === "end" ? a.right - width : a.left;
    left = Math.min(Math.max(GAP, left), vw - width - GAP);
    const top = above ? a.top - GAP - height : a.bottom + GAP;

    // Written straight to the DOM: runs on every scroll frame, no re-render needed.
    panel.dataset.side = above ? "top" : "bottom";
    Object.assign(panel.style, { top: `${top}px`, left: `${left}px`, maxHeight: `${maxHeight}px`, visibility: "visible" });
  }, [anchorRef, align, onClose]);

  React.useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onClose();
      anchorRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    // Move focus into the panel for keyboard users.
    panelRef.current?.querySelector<HTMLElement>("a,button,[tabindex]")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      data-side="bottom"
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "z-(--z-popover) overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/40",
        "animate-[pop-in_140ms_ease-out] data-[side=top]:origin-bottom data-[side=bottom]:origin-top",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
