"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { households, itemEvents, itemSteps, items } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth";
import { driveOrderSchema, goalStepSchema } from "@/lib/schemas/item";
import { moveStep } from "@/lib/domain/drives";
import type { ActionResult } from "@/lib/actions/items";

function refresh() {
  revalidatePath("/", "layout");
}

/**
 * Move a step up or down in a drive, take it out, or put it back.
 *
 * Taking a step out hides it from that meeting and nothing else: the tasks, bills
 * and decisions it showed are untouched on their own screens, and restoring the
 * step brings it back exactly as it was.
 */
export async function reorderDrive(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = driveOrderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "That change could not be made" };
  const { periodType, stepId, action } = parsed.data;

  const [household] = await db
    .select({ driveOrder: households.driveOrder })
    .from(households)
    .where(eq(households.id, session.householdId))
    .limit(1);

  const next = moveStep(periodType, stepId, action, household?.driveOrder ?? null);
  if (next === "last") return { ok: false, error: "Keep at least one step in the meeting" };
  if (!next) return { ok: true };

  await db
    .update(households)
    .set({ driveOrder: { ...(household?.driveOrder ?? {}), [periodType]: next } })
    .where(eq(households.id, session.householdId));

  refresh();
  return { ok: true };
}

/**
 * Tick a step on a goal straight from the Goals screen, without opening it. The
 * steps are the strategy, so moving one is worth an activity event like any other
 * change to the goal.
 */
export async function toggleGoalStep(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = goalStepSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "That step could not be updated" };
  const { itemId, stepId, done } = parsed.data;

  // Scope by household before touching anything: the step id alone says nothing
  // about who owns it.
  const [owner] = await db
    .select({ id: items.id, title: items.title })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.householdId, session.householdId)))
    .limit(1);
  if (!owner) return { ok: false, error: "That goal could not be found" };

  const [step] = await db
    .select({ id: itemSteps.id, text: itemSteps.text })
    .from(itemSteps)
    .where(and(eq(itemSteps.id, stepId), eq(itemSteps.itemId, itemId)))
    .limit(1);
  if (!step) return { ok: false, error: "That step could not be found" };

  await db.transaction(async (tx) => {
    await tx.update(itemSteps).set({ done }).where(eq(itemSteps.id, step.id));
    await tx.insert(itemEvents).values({
      householdId: session.householdId,
      itemId,
      userId: session.user.id,
      type: "updated",
      summary: `${done ? "step done" : "step reopened"}: ${step.text}`,
    });
  });

  refresh();
  return { ok: true };
}
