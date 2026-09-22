import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CalendarClock, Check, ChevronDown, Link2, Share2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { BookingPreview } from "@/components/home/booking-preview";
import { AvailabilityVisual, EmbedVisual, InviteVisual, RulesVisual, ShareVisual, TimeZoneVisual } from "@/components/home/feature-visuals";
import { cn } from "@/lib/utils";
import { requestNow } from "@/server/clock";

export const metadata: Metadata = {
  title: { absolute: "Slotwell — Book a time. Skip the back-and-forth." },
  description:
    "Share one link. Guests pick a time that's really free in your calendar, in their own time zone, and get a confirmed invite with a Google Meet link. Free to start.",
  openGraph: {
    title: "Slotwell — scheduling without the back-and-forth",
    description: "Share one link, get confirmed meetings with Meet links. Free to start.",
    type: "website",
  },
};

const steps = [
  { icon: CalendarClock, title: "Set your hours", text: "Connect Google Calendar and choose when you're open. Busy times are blocked automatically." },
  { icon: Share2, title: "Share your link", text: "Send it in a message, add it to your email signature or embed it on your website." },
  { icon: Zap, title: "Get booked", text: "Guests pick a free slot. Both of you get an invite with a Meet link — no emails back and forth." },
];

const features = [
  { title: "Only times you're really free", text: "Slotwell checks your Google Calendar live, so nobody can book over a meeting, a trip or lunch.", visual: <AvailabilityVisual />, wide: true },
  { title: "Every time zone, handled", text: "Guests see slots in their own time. You see them in yours.", visual: <TimeZoneVisual /> },
  { title: "Invites with Meet links", text: "Each booking lands in both calendars with a Google Meet link and one-click reschedule or cancel.", visual: <InviteVisual /> },
  { title: "Rules that protect your day", text: "Buffers, minimum notice, daily limits, days off and how far ahead people can book.", visual: <RulesVisual /> },
  { title: "Embed on your site", text: "Drop your booking page into any website. It follows your site's light or dark theme.", visual: <EmbedVisual /> },
  { title: "Share anywhere", text: "Send your link or a meeting invite to a person or a group chat in one tap.", visual: <ShareVisual /> },
];

const faqs = [
  { q: "Is Slotwell free?", a: "Yes. Everything on this page is free to use today. Paid plans with extras like custom branding may come later." },
  { q: "Do my guests need an account?", a: "No. Guests just open your link, pick a time and enter their name and email. They get a confirmation with a link to reschedule or cancel." },
  { q: "Which calendars does it work with?", a: "Google Calendar today, including Google Meet links. Slotwell reads your busy times and adds each booking as an event." },
  { q: "Can I put it on my own website?", a: "Yes. Copy the embed code from Settings and paste it into any page. Allowed sites are set per account, so your page can't be framed elsewhere." },
  { q: "What happens to my data?", a: "Slotwell only checks when you're busy — it doesn't read your event details — and it never sells or shares your data. There are no ads or trackers." },
];

export default async function HomePage() {
  await connection(); // read OWNER_USERNAME at request time, not build time
  const demo = process.env.OWNER_USERNAME;
  const now = requestNow();
  const year = new Date(now).getUTCFullYear();

  return (
    <main className="flex-1 overflow-x-clip">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-(--z-sticky) border-b border-transparent bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 md:px-6">
          <Link href="/" aria-label="Slotwell home"><Logo /></Link>
          <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#how" className="transition hover:text-foreground">How it works</a>
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
            <a href="#faq" className="transition hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden h-9 items-center rounded-full px-4 text-sm font-medium text-muted transition hover:text-foreground sm:inline-flex">Sign in</Link>
            <ButtonLink href="/login" size="sm">Get started</ButtonLink>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] opacity-60" />
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />

        <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-14 md:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-32">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden /> Free to start · no credit card
            </span>
            <h1 className="mt-6 text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-[3.6rem] xl:text-[4rem]">
              Book a time.{" "}
              <span className="bg-gradient-to-r from-accent via-fuchsia-400 to-accent bg-clip-text text-transparent sm:block">Skip the back&#8209;and&#8209;forth.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Share one link. People pick a time that&apos;s actually free in your calendar — in their own time zone — and you both get
              an invite with a Google Meet link.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/login" size="lg" className="group shadow-lg shadow-accent/25">
                Create your free page <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              {demo && <ButtonLink href={`/${demo}`} size="lg" variant="secondary">See a live page</ButtonLink>}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {["Set up in 2 minutes", "Works with Google Calendar", "Guests don't need an account"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-accent" aria-hidden /> {t}</li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-full max-w-lg animate-fade-up [animation-delay:120ms] lg:max-w-none">
            <BookingPreview now={now} />
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="scroll-mt-20 border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-6 md:py-24">
          <SectionHeading eyebrow="How it works" title="From link to meeting in three steps" />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-card border border-border bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Icon className="h-5 w-5" aria-hidden /></span>
                  <span className="font-mono text-sm text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-6 md:py-28">
          <SectionHeading eyebrow="Features" title="Everything a booking page needs. Nothing it doesn't." />
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.title} className={cn("group flex flex-col rounded-card border border-border bg-surface p-6 transition hover:border-accent/40", f.wide && "lg:col-span-2")}>
                <div className="mb-6 flex-1">{f.visual}</div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { icon: Link2, title: "Links that manage themselves", text: "Guests reschedule or cancel from their email. Your calendar updates on its own." },
              { icon: ShieldCheck, title: "Private by default", text: "No ads, no trackers, no third-party branding on your pages." },
              { icon: Zap, title: "Fast everywhere", text: "Lightweight pages that load instantly on any phone or laptop." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 rounded-card border border-border p-5">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <h3 className="text-sm font-medium">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section id="pricing" className="scroll-mt-20 border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-6 md:py-24">
          <SectionHeading eyebrow="Pricing" title="Free while we grow" text="Start free today. Extras for power users are on the way." />
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
            <div className="relative rounded-card border border-accent/50 bg-surface p-7 shadow-xl shadow-accent/10">
              <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">Available now</span>
              <h3 className="text-lg font-medium">Free</h3>
              <p className="mt-3 flex items-baseline gap-1"><span className="text-4xl font-semibold tracking-tight">$0</span><span className="text-sm text-muted">/ forever</span></p>
              <p className="mt-2 text-sm text-muted">Everything you need for a personal booking page.</p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {["Unlimited bookings", "Multiple meeting types", "Google Calendar + Meet", "Custom questions & rules", "Embed on your website", "Email confirmations with reschedule links"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> {f}</li>
                ))}
              </ul>
              <ButtonLink href="/login" className="mt-8 w-full">Get started free</ButtonLink>
            </div>
            <div className="rounded-card border border-border bg-surface/60 p-7">
              <h3 className="text-lg font-medium">Pro</h3>
              <p className="mt-3 flex items-baseline gap-1"><span className="text-4xl font-semibold tracking-tight text-muted">Soon</span></p>
              <p className="mt-2 text-sm text-muted">For professionals and small teams.</p>
              <ul className="mt-6 space-y-2.5 text-sm text-muted">
                {["Everything in Free", "Your own branding", "Remove “Powered by Slotwell”", "Team and group pages", "Payments for paid sessions", "Priority support"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {f}</li>
                ))}
              </ul>
              <span className="mt-8 flex h-11 w-full items-center justify-center rounded-full border border-dashed border-border text-sm text-muted">Planned</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:px-6 md:py-28 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" align="left" text="Short answers to the things people ask most." />
          <div className="divide-y divide-border rounded-card border border-border bg-surface">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium">
                  {q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="-mt-1 pb-5 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="px-5 pb-20 md:px-6 md:pb-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-accent/30 bg-surface px-6 py-16 text-center md:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(161,0,255,0.35),transparent)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-5xl">Your next meeting is one link away</h2>
            <p className="mx-auto mt-4 max-w-lg text-muted">Create your booking page in about two minutes. Free, no credit card.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/login" size="lg" className="shadow-lg shadow-accent/25">Get started free <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
              {demo && <ButtonLink href={`/${demo}`} size="lg" variant="secondary">See a live page</ButtonLink>}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <Logo />
            <p className="mt-2 text-sm text-muted">Scheduling without the back-and-forth.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-muted md:px-6">
            © {year} Slotwell · Built by <a href="https://prashanta.dev" className="text-foreground hover:text-accent">prashanta.dev</a>
          </p>
        </div>
      </footer>
    </main>
  );
}

function SectionHeading({ eyebrow, title, text, align = "center" }: { eyebrow: string; title: string; text?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-md"}>
      <p className="text-sm font-medium uppercase tracking-widest text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-muted">{text}</p>}
    </div>
  );
}
