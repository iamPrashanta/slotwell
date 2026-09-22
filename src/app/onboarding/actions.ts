"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { setupOwner } from "@server/owner-setup.mjs";
import { requireUser } from "@/server/session";
import { usernameSchema } from "@/lib/usernames";
import { isValidTimeZone } from "@/lib/availability/time";

const schema = z.object({
  displayName: z.string().trim().min(1, "Add your name").max(80),
  username: usernameSchema,
  timeZone: z.string().max(64).refine(isValidTimeZone, "Pick a time zone"),
});

export async function completeOnboarding(input: z.infer<typeof schema>): Promise<{ ok: false; error: string } | undefined> {
  const session = await requireUser();
  if (session.onboarded) redirect("/dashboard");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  try {
    await setupOwner(session.user.id, parsed.data);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return { ok: false, error: "That username is taken. Try another." };
    if (code === "23514") return { ok: false, error: "That username isn't allowed. Try another." };
    console.error("onboarding failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  redirect("/dashboard");
}
