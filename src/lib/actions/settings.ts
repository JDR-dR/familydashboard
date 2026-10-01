"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { households, users } from "@/lib/db/schema";
import { issueToken, requireSession, setPassword } from "@/lib/auth";
import { checkPasswordStrength } from "@/lib/auth/password";
import { inviteSchema, namesSchema, passwordSchema } from "@/lib/schemas/item";

export async function saveNames(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const parsed = namesSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Those names could not be saved" };

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, session.householdId))
    .limit(1);

  const names = { ...(household?.personNames ?? {}) };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value && value.trim()) names[key] = value.trim();
    else delete names[key];
  }

  await db.update(households).set({ personNames: names }).where(eq(households.id, session.householdId));
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Invite-only account creation: there is no public sign-up page. The owner creates
 * the account, and the returned link is what the new person uses to set a password.
 */
export async function invitePerson(
  formData: FormData,
): Promise<{ ok: boolean; error?: string; link?: string }> {
  const session = await requireSession();
  if (session.user.role !== "owner") return { ok: false, error: "Only the owner can invite people" };

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message };

  const email = parsed.data.email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { ok: false, error: "Someone with that email already has an account" };

  const [created] = await db
    .insert(users)
    .values({
      householdId: session.householdId,
      email,
      name: parsed.data.name,
      personKey: parsed.data.personKey || null,
      role: parsed.data.role,
    })
    .returning();

  const token = await issueToken(created.id, "invite", 72);
  revalidatePath("/settings");
  return { ok: true, link: `${process.env.APP_URL ?? ""}/invite/${token}` };
}

export async function changeOwnPassword(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message };

  const strength = await checkPasswordStrength(parsed.data.password);
  if (!strength.ok) return { ok: false, error: strength.reason };

  await setPassword(session.user.id, parsed.data.password);
  return { ok: true };
}
