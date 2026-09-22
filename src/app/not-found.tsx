import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm uppercase tracking-widest text-accent">404</p>
      <h1 className="text-2xl font-semibold">This booking link doesn&apos;t exist</h1>
      <p className="text-muted">Check the link, or ask the person who shared it for a new one.</p>
      <ButtonLink href="/" variant="secondary">Go to Slotwell</ButtonLink>
    </main>
  );
}
