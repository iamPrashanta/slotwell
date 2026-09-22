"use client";

import * as React from "react";
import { Check, Copy, Mail, MessageCircle, MessageSquareText, Send, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "./popover";

type Props = {
  /** Short title, used as the email subject and native share title. */
  title: string;
  /** Full message people receive (time, link, …). */
  text: string;
  /** Link to share, when there is one. Added to the message if it isn't already in it. */
  url?: string | null;
  label?: string;
  size?: "sm" | "icon";
  align?: "left" | "right";
  className?: string;
};

const noopSubscribe = () => () => {};

/**
 * Share popover: WhatsApp, Telegram, email, SMS, copy, and the phone's own share sheet.
 * Everything opens a normal link — nothing is sent from Slotwell's server.
 */
export function ShareMenu({ title, text, url, label = "Share", size = "sm", align = "left", className }: Props) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const canNativeShare = React.useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  const menuId = React.useId();

  const message = url && !text.includes(url) ? `${text}\n${url}` : text;
  const enc = encodeURIComponent;

  const targets = [
    { name: "WhatsApp", icon: MessageCircle, tint: "text-[#25D366]", href: `https://wa.me/?text=${enc(message)}` },
    {
      name: "Telegram",
      icon: Send,
      tint: "text-[#229ED9]",
      href: `https://t.me/share/url?url=${enc(url ?? "")}&text=${enc(url ? text.replace(url, "").trim() : message)}`,
    },
    { name: "Email", icon: Mail, tint: "text-accent", href: `mailto:?subject=${enc(title)}&body=${enc(message)}` },
    { name: "Text message", icon: MessageSquareText, tint: "text-accent", href: `sms:?&body=${enc(message)}` },
  ];

  return (
    <div className={cn("inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={size === "icon" ? label : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full border border-border text-sm font-medium transition hover:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/60 outline-none",
          size === "icon" ? "p-2" : "h-9 px-4",
          open && "border-accent/60 bg-accent-soft",
        )}
      >
        <Share2 className="h-4 w-4" aria-hidden />
        {size !== "icon" && label}
      </button>

      <Popover open={open} onClose={close} anchorRef={triggerRef} align={align === "right" ? "end" : "start"} id={menuId} role="menu" className="w-60">
          <p className="px-3 pb-1.5 pt-1 text-xs uppercase tracking-wide text-muted">Share with a person or group</p>
          {targets.map((t) => (
            <a
              key={t.name}
              role="menuitem"
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-muted focus-visible:bg-surface-muted outline-none"
            >
              <t.icon className={cn("h-4 w-4", t.tint)} aria-hidden /> {t.name}
            </a>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await navigator.clipboard.writeText(message).catch(() => {});
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-surface-muted focus-visible:bg-surface-muted outline-none"
          >
            {copied ? <Check className="h-4 w-4 text-accent" aria-hidden /> : <Copy className="h-4 w-4 text-muted" aria-hidden />}
            <span aria-live="polite">{copied ? "Copied" : "Copy message"}</span>
          </button>
          {canNativeShare && (
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                await navigator.share({ title, text, url: url ?? undefined }).catch(() => {});
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-surface-muted focus-visible:bg-surface-muted outline-none"
            >
              <Share2 className="h-4 w-4 text-muted" aria-hidden /> More apps…
            </button>
          )}
      </Popover>
    </div>
  );
}
