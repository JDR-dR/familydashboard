"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { households } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth";
import { sectionBudgetSchema } from "@/lib/schemas/item";
import type { ActionResult } from "@/lib/actions/items";

/**
 * Set one section's budget figure, typed in from the household's real budget.
 *
 * The app does not try to be the budget. It keeps the number you already decided
 * elsewhere so that what comes up during the week can be read against it. An
 * empty box clears the figure back to "not set", which is not the same as zero.
 */
export async function setSectionBudget(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = sectionBudgetSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "That is not an amount" };
  const { section, amount } = parsed.data;

  const [household] = await db
    .select({ budget: households.budget })
    .from(households)
    .where(eq(households.id, session.householdId))
    .limit(1);

  const next: Record<string, string> = { ...(household?.budget ?? {}) };
  if (amount === null) delete next[section];
  else next[section] = amount;

  await db
    .update(households)
    .set({ budget: next })
    .where(eq(households.id, session.householdId));

  revalidatePath("/", "layout");
  return { ok: true };
}
