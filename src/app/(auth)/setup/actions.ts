"use server";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { households, users } from "@/lib/db/schema";
import { createSession } from "@/lib/auth";
import { checkPasswordStrength, hashPassword } from "@/lib/auth/password";
import { passwordSchema } from "@/lib/schemas/item";
import { z } from "zod";

const setupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().email("That does not look like an email address"),
});

export async function createFirstOwner(formData: FormData): Promise<{ error?: string }> {
  const fields = Object.fromEntries(formData.entries());
  const details = setupSchema.safeParse(fields);
  if (!details.success) return { error: details.error.errors[0]?.message };

  const passwords = passwordSchema.safeParse(fields);
  if (!passwords.success) return { error: passwords.error.errors[0]?.message };

  const strength = await checkPasswordStrength(passwords.data.password);
  if (!strength.ok) return { error: strength.reason };

  // Guarded again here: the page check is convenience, this is the real lock.
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if ((row?.count ?? 0) > 0) return { error: "This dashboard has already been set up." };

  const [household] = await db
    .insert(households)
    .values({
      name: "Our household",
      personNames: { dad: details.data.name },
      timezone: process.env.APP_TIMEZONE ?? "Africa/Johannesburg",
    })
    .returning();

  const [owner] = await db
    .insert(users)
    .values({
      householdId: household.id,
      email: details.data.email.toLowerCase(),
      name: details.data.name,
      personKey: "dad",
      role: "owner",
      passwordHash: await hashPassword(passwords.data.password),
    })
    .returning();

  await createSession(owner.id);
  return {};
}
