"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { freedomScores, households } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth";
import { freedomBaselineSchema, freedomCaptureSchema } from "@/lib/schemas/item";
import type { ActionResult } from "@/lib/actions/items";

function refresh() {
  revalidatePath("/", "layout");
}

/**
 * The monthly spend you decide on. Blank clears the override, and the score goes
 * back to reading the bills.
 */
export async function saveFreedomBaseline(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = freedomBaselineSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "That amount could not be read" };

  await db
    .update(households)
    .set({
      monthlyNeeds: parsed.data.monthlyNeeds,
      monthlyWants: parsed.data.monthlyWants,
    })
    .where(eq(households.id, session.householdId));

  refresh();
  return { ok: true };
}

/**
 * Takes a reading of the score and keeps it. One per month: capturing twice in the
 * same month overwrites that month rather than cluttering the trend, so a
 * correction is a correction and not a second data point.
 */
export async function captureFreedomScore(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = freedomCaptureSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "That reading could not be saved" };
  const { periodStart, passive, needs, wants, score, note } = parsed.data;

  const [existing] = await db
    .select({ id: freedomScores.id })
    .from(freedomScores)
    .where(
      and(
        eq(freedomScores.householdId, session.householdId),
        eq(freedomScores.periodStart, periodStart),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(freedomScores)
      .set({ passive, needs, wants, score, note: note ?? null, capturedBy: session.user.id })
      .where(eq(freedomScores.id, existing.id));
  } else {
    await db.insert(freedomScores).values({
      householdId: session.householdId,
      periodStart,
      passive,
      needs,
      wants,
      score,
      note: note ?? null,
      capturedBy: session.user.id,
    });
  }

  refresh();
  return { ok: true };
}
