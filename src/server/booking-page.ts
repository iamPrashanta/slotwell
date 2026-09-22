import "server-only";

import { getEventType, getOwnerByUsername } from "./data";
import type { WidgetEvent, WidgetOwner } from "@/components/booking/booking-widget";

/** Loads the public data a booking page needs, or null if the link is invalid. */
export async function loadBookingPage(username: string, slug: string): Promise<{ owner: WidgetOwner; event: WidgetEvent } | null> {
  const owner = await getOwnerByUsername(username);
  if (!owner) return null;
  const event = await getEventType(owner.ownerId, slug);
  if (!event) return null;
  return {
    owner: { username: owner.username, displayName: owner.displayName, image: owner.image },
    event: {
      slug: event.slug,
      title: event.title,
      description: event.description,
      durationMin: event.durationMin,
      locationKind: event.locationKind,
      questions: event.questions,
    },
  };
}

export function themeParam(value: string | string[] | undefined): "light" | "dark" | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

export function topicParam(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const topic = value.replace(/[-_]+/g, " ").trim().slice(0, 120);
  return topic ? topic.charAt(0).toUpperCase() + topic.slice(1) : undefined;
}
