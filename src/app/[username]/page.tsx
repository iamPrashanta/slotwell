import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getOwnerByUsername, listEventTypes } from "@/server/data";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const owner = await getOwnerByUsername((await params).username);
  return owner ? { title: `Book time with ${owner.displayName}` } : { title: "Not found" };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const owner = await getOwnerByUsername(username);
  if (!owner) notFound();
  const events = await listEventTypes(owner.ownerId);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 animate-fade-up">
      <div className="mb-10 flex flex-col items-center text-center">
        {owner.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={owner.image} alt="" className="mb-4 h-20 w-20 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent">
            {owner.displayName.slice(0, 1)}
          </span>
        )}
        <h1 className="text-2xl font-semibold">{owner.displayName}</h1>
        {owner.bio && <p className="mt-2 max-w-md text-muted">{owner.bio}</p>}
      </div>

      <ul className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              href={`/${owner.username}/${event.slug}`}
              className="group flex items-center justify-between gap-4 rounded-card border border-border bg-surface p-5 transition hover:border-accent/60"
            >
              <div>
                <h2 className="font-medium">{event.title}</h2>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                  <Clock className="h-4 w-4" aria-hidden /> {event.durationMin} min
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted transition group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
            </Link>
          </li>
        ))}
        {events.length === 0 && <p className="text-center text-muted">No meeting types are open right now.</p>}
      </ul>

      <div className="mt-16 flex justify-center opacity-60">
        <Logo className="scale-90" />
      </div>
    </main>
  );
}
