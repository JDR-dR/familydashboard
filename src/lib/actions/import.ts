"use server";

import { revalidatePath } from "next/cache";
import { eq, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { households, itemEvents, items, meetings } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth";
import { buildPlan, normaliseRecords } from "@/lib/import/prototype";

export interface ImportReport {
  ok: boolean;
  error?: string;
  committed?: boolean;
  counts?: Record<string, number>;
  itemCount?: number;
  meetingCount?: number;
  totalAmount?: string;
  names?: Record<string, string> | null;
  problems?: string[];
  nowHolding?: number;
}

/**
 * Reads the previous dashboard's export and, on a dry run, reports what it would
 * do. Running it twice changes nothing: every row is matched on its original id.
 */
export async function importPrototype(
  json: string,
  commit: boolean,
): Promise<ImportReport> {
  const session = await requireSession();
  if (session.user.role !== "owner") {
    return { ok: false, error: "Only the owner can import data" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file is not valid JSON" };
  }

  const records = normaliseRecords(parsed);
  if (!records.length) return { ok: false, error: "No records found in that file" };

  const plan = buildPlan(records);
  if (!plan.items.length) {
    return { ok: false, error: "No importable records found in that file" };
  }

  const report: ImportReport = {
    ok: true,
    committed: false,
    counts: plan.counts,
    itemCount: plan.items.length,
    meetingCount: plan.meetings.length,
    totalAmount: plan.totalAmount.toLocaleString("en-ZA", {
      style: "currency",
      currency: "ZAR",
      maximumFractionDigits: 0,
    }),
    names: plan.names,
    problems: plan.problems,
  };

  if (!commit) return report;

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, session.householdId))
    .limit(1);

  await db.transaction(async (tx) => {
    if (plan.names) {
      // Merge, never replace: your own name is already set up.
      await tx
        .update(households)
        .set({ personNames: { ...(household?.personNames ?? {}), ...plan.names } })
        .where(eq(households.id, session.householdId));
    }

    for (const item of plan.items) {
      const values = {
        ...item,
        householdId: session.householdId,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      };
      await tx.insert(items).values(values).onConflictDoUpdate({
        target: items.id,
        set: values,
      });

      const [existing] = await tx
        .select({ count: raw<number>`count(*)::int` })
        .from(itemEvents)
        .where(eq(itemEvents.itemId, item.id));

      if (!existing?.count) {
        await tx.insert(itemEvents).values({
          householdId: session.householdId,
          itemId: item.id,
          userId: session.user.id,
          type: "created",
          summary: "added in the previous dashboard",
          createdAt: item.createdAt,
        });
      }
    }

    for (const meeting of plan.meetings) {
      await tx
        .insert(meetings)
        .values({ ...meeting, householdId: session.householdId })
        .onConflictDoNothing();
    }
  });

  const [after] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(items)
    .where(eq(items.householdId, session.householdId));

  revalidatePath("/", "layout");
  return { ...report, committed: true, nowHolding: after?.count ?? 0 };
}
