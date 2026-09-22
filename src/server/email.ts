import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { buildIcs, type IcsEvent } from "@/lib/ics";

let transporter: Transporter | null = null;

function transport(): Transporter {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error("Email delivery is not configured.");
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
  });
  return transporter;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface BookingEmail {
  to: string;
  replyTo?: string;
  subject: string;
  /** Plain-text lines; the HTML version is generated from them. */
  lines: string[];
  action?: { label: string; url: string };
  /** Calendar invite (REQUEST/CANCEL). Omit for notices to the owner, whose Google Calendar is already updated. */
  invite?: IcsEvent;
}

/** Sends one booking email with an .ics invite (REQUEST or CANCEL) that calendar apps pick up. */
export async function sendBookingEmail(email: BookingEmail): Promise<void> {
  const text = [...email.lines, ...(email.action ? ["", `${email.action.label}: ${email.action.url}`] : [])].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0a0a0a">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e4e4e7">
<p style="margin:0 0 24px;font-weight:600;color:#a100ff">slotwell</p>
${email.lines.map((line) => (line ? `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(line)}</p>` : "")).join("")}
${email.action ? `<p style="margin:24px 0 0"><a href="${escapeHtml(email.action.url)}" style="display:inline-block;background:#a100ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px">${escapeHtml(email.action.label)}</a></p>` : ""}
</div></body></html>`;

  await transport().sendMail({
    from: process.env.SMTP_FROM,
    to: email.to,
    replyTo: email.replyTo,
    subject: email.subject,
    text,
    html,
    ...(email.invite
      ? {
          icalEvent: {
            method: email.invite.method.toLowerCase() as "request" | "cancel",
            filename: email.invite.method === "CANCEL" ? "cancel.ics" : "invite.ics",
            content: buildIcs(email.invite),
          },
        }
      : {}),
  });
}
