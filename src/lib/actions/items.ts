"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemEvents, itemLinks, itemSteps, items, meetings, type Item } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth";
import { markSeen } from "@/lib/db/queries";
import { DATA_FIELDS, itemFormSchema, meetingSchema, noteSchema } from "@/lib/schemas/item";
import { KIND_DEFS, type Kind } from "@/lib/domain/kinds";
import { defaultDueDate, nextOccurrence } from "@/lib/domain/rules";
import { today, weekStart } from "@/lib/domain/week";
import { money } from "@/lib/domain/money";
import { toCents } from "@/lib/domain/money";

export interface ActionResult {
  ok: boolean;
  error?: string;
  itemId?: string;
}

const newId = () => `i${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;

function personLabel(key: string | null, names: Record<string, string>): string {
  if (!key) return "nobody";
  return names[key] ?? key;
}

/**
 * What changed, in the words the family would use. Returns null when nothing
 * meaningful changed, so opening and closing an item leaves no trace.
 */
function describeChange(
  before: Item,
  after: { [key: string]: unknown },
  names: Record<string, string>,
): string | null {
  const parts: string[] = [];
  const stateField = KIND_DEFS[before.kind as Kind].stateField;
  const beforeState = stateField === "stage" ? before.stage : before.status;
  const afterState = (stateField === "stage" ? after.stage : after.status) as string | null;

  if ((beforeState ?? "") !== (afterState ?? "") && afterState) parts.push(afterState);
  if ((before.who ?? "") !== ((after.who as string) ?? "")) {
    parts.push(`to ${personLabel(after.who as string | null, names)}`);
  }
  if ((before.dueDate ?? "") !== ((after.dueDate as string) ?? "")) {
    parts.push(after.dueDate ? `date ${after.dueDate}` : "date cleared");
  }
  if (toCents(before.amount) !== toCents(after.amount as string)) {
    parts.push(after.amount ? money(toCents(after.amount as string)) : "amount cleared");
  }
  if ((before.slot ?? "") !== ((after.slot as string) ?? "") && after.slot) {
    parts.push(`→ ${after.slot}`);
  }
  if ((before.nextStep ?? "") !== ((after.nextStep as string) ?? "") && after.nextStep) {
    parts.push(`next: ${after.nextStep}`);
  }
  if ((before.title ?? "") !== ((after.title as string) ?? "")) parts.push("renamed");
  if ((before.notes ?? "") !== ((after.notes as string) ?? "")) parts.push("notes");

  return parts.length ? parts.join(" · ") : null;
}

function refreshEverything() {
  // The dataset is small and every screen is a view over the same items, so a
  // write refreshes the whole app rather than guessing which screens care.
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------ create/edit -- */

export async function saveItem(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const raw = Object.fromEntries(formData.entries());
  const parsed = itemFormSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "That could not be saved" };
  }

  const values = parsed.data;
  const kind = values.kind as Kind;
  const def = KIND_DEFS[kind];
  const names = (await db.query.households.findFirst({
    where: (household, { eq: equals }) => equals(household.id, session.householdId),
  }))?.personNames ?? {};

  const data: Record<string, unknown> = {};
  for (const field of DATA_FIELDS) {
    const value = (values as Record<string, unknown>)[field];
    if (value !== undefined && value !== null) data[field] = value;
  }

  const stateValue = def.stateField === "stage" ? values.stage : values.status;
  const isDoneState = stateValue ? def.done.includes(stateValue) : false;
  const incomeDone = kind === "income" && Boolean(values.actual || values.receivedDate);
  const done = isDoneState || incomeDone;

  const base = {
    kind,
    title: values.title,
    who: values.who,
    dueDate: values.dueDate,
    amount: values.amount,
    status: def.stateField === "status" ? values.status : null,
    stage: def.stateField === "stage" ? values.stage : null,
    section: values.section ?? def.section,
    slot: kind === "task" ? values.slot ?? "This week" : null,
    nextStep: values.nextStep,
    notes: values.notes,
    category: values.category,
    projectId: values.projectId,
    linkedItemId: values.linkedItemId,
    updatedBy: session.user.id,
    updatedAt: new Date(),
  };

  const existing = values.id
    ? (
        await db
          .select()
          .from(items)
          .where(and(eq(items.id, values.id), eq(items.householdId, session.householdId)))
          .limit(1)
      )[0]
    : undefined;

  const itemId = existing?.id ?? newId();

  await db.transaction(async (tx) => {
    if (existing) {
      const merged = { ...(existing.data as Record<string, unknown>), ...data };
      const summary = describeChange(existing, { ...base, ...values }, names);

      await tx
        .update(items)
        .set({
          ...base,
          data: merged,
          slotWeek:
            base.slot === "Next week"
              ? existing.slot === "Next week"
                ? existing.slotWeek
                : weekStart(today())
              : null,
          doneAt: done ? existing.doneAt ?? today() : null,
        })
        .where(eq(items.id, itemId));

      if (summary) {
        await tx.insert(itemEvents).values({
          householdId: session.householdId,
          itemId,
          userId: session.user.id,
          type: "updated",
          summary,
        });
      }
    } else {
      await tx.insert(items).values({
        ...base,
        id: itemId,
        householdId: session.householdId,
        data,
        createdBy: session.user.id,
        slotWeek: base.slot === "Next week" ? weekStart(today()) : null,
        doneAt: done ? today() : null,
      });

      await tx.insert(itemEvents).values({
        householdId: session.householdId,
        itemId,
        userId: session.user.id,
        type: "created",
        summary: "added",
      });
    }

    // Steps and links are replaced wholesale; there are at most three and two.
    await tx.delete(itemSteps).where(eq(itemSteps.itemId, itemId));
    await tx.delete(itemLinks).where(eq(itemLinks.itemId, itemId));

    const steps = [0, 1, 2]
      .map((index) => ({
        text: (values as Record<string, unknown>)[`step${index}`] as string | null,
        done: Boolean((values as Record<string, unknown>)[`step${index}done`]),
      }))
      .filter((step) => step.text);

    if (steps.length) {
      await tx.insert(itemSteps).values(
        steps.map((step, position) => ({
          itemId,
          position,
          text: step.text as string,
          done: step.done,
        })),
      );
    }

    const links = [0, 1]
      .map((index) => ({
        url: (values as Record<string, unknown>)[`link${index}url`] as string | null,
        label: (values as Record<string, unknown>)[`link${index}label`] as string | null,
      }))
      .filter((link) => link.url);

    if (links.length) {
      await tx.insert(itemLinks).values(
        links.map((link, position) => ({
          itemId,
          position,
          url: /^https?:\/\//i.test(link.url as string) ? (link.url as string) : `https://${link.url}`,
          label: link.label,
        })),
      );
    }

    // A repeating bill that has just been paid creates its next occurrence, once.
    if (kind === "bill" && done && existing && !existing.doneAt) {
      const alreadySpawned = (existing.data as Record<string, unknown>).spawnedId;
      const next = nextOccurrence({ dueDate: values.dueDate, repeat: values.repeat });
      if (!alreadySpawned && next) {
        const nextId = newId();
        await tx.insert(items).values({
          id: nextId,
          householdId: session.householdId,
          kind: "bill",
          title: values.title,
          who: values.who,
          dueDate: next,
          amount: values.amount,
          status: "To pay",
          section: "home",
          category: values.category,
          notes: values.notes,
          data: { repeat: values.repeat },
          createdBy: session.user.id,
        });
        await tx.insert(itemEvents).values({
          householdId: session.householdId,
          itemId: nextId,
          userId: session.user.id,
          type: "created",
          summary: `added automatically, repeats ${String(values.repeat).toLowerCase()}`,
        });
        await tx
          .update(items)
          .set({ data: { ...(existing.data as Record<string, unknown>), ...data, spawnedId: nextId } })
          .where(eq(items.id, itemId));
      }
    }
  });

  refreshEverything();
  return { ok: true, itemId };
}

/* ----------------------------------------------------------- quick writes -- */

export async function toggleDone(itemId: string, done: boolean): Promise<ActionResult> {
  const session = await requireSession();
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.householdId, session.householdId)))
    .limit(1);
  if (!item) return { ok: false, error: "That item is gone" };

  const def = KIND_DEFS[item.kind as Kind];
  const nextState = done ? def.done[0] : def.states.find((state) => def.action.includes(state)) ?? def.states[0];

  await db.transaction(async (tx) => {
    await tx
      .update(items)
      .set({
        [def.stateField]: nextState,
        doneAt: done ? today() : null,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(items.id, itemId));
    await tx.insert(itemEvents).values({
      householdId: session.householdId,
      itemId,
      userId: session.user.id,
      type: "updated",
      summary: nextState,
    });
  });

  refreshEverything();
  return { ok: true };
}

export async function quickAddTask(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Write what needs to happen" };

  const slot = String(formData.get("slot") ?? "This week");
  const whoRaw = String(formData.get("who") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").replace(/[^0-9.-]/g, "");
  const dueRaw = String(formData.get("dueDate") ?? "");
  const slotValue = (["This week", "Next week", "Monthly drive", "To decide together"] as const)
    .includes(slot as never)
    ? (slot as "This week" | "Next week" | "Monthly drive" | "To decide together")
    : "This week";

  const itemId = newId();
  await db.transaction(async (tx) => {
    await tx.insert(items).values({
      id: itemId,
      householdId: session.householdId,
      kind: "task",
      title,
      who: whoRaw || null,
      dueDate: dueRaw || defaultDueDate(slotValue),
      amount: amountRaw ? Number(amountRaw).toFixed(2) : null,
      status: "Needs Action",
      section: "general",
      slot: slotValue,
      slotWeek: slotValue === "Next week" ? weekStart(today()) : null,
      createdBy: session.user.id,
    });
    await tx.insert(itemEvents).values({
      householdId: session.householdId,
      itemId,
      userId: session.user.id,
      type: "created",
      summary: "added",
    });
  });

  refreshEverything();
  return { ok: true, itemId };
}

export async function addNote(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = noteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message };

  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, parsed.data.itemId), eq(items.householdId, session.householdId)))
    .limit(1);
  if (!item) return { ok: false, error: "That item is gone" };

  await db.insert(itemEvents).values({
    householdId: session.householdId,
    itemId: parsed.data.itemId,
    userId: session.user.id,
    type: "note",
    summary: "added a note",
    body: parsed.data.body,
  });

  refreshEverything();
  return { ok: true };
}

export async function archiveItem(itemId: string): Promise<ActionResult> {
  const session = await requireSession();
  await db.transaction(async (tx) => {
    await tx
      .update(items)
      .set({ archivedAt: new Date(), updatedBy: session.user.id, updatedAt: new Date() })
      .where(and(eq(items.id, itemId), eq(items.householdId, session.householdId)));
    await tx.insert(itemEvents).values({
      householdId: session.householdId,
      itemId,
      userId: session.user.id,
      type: "updated",
      summary: "removed",
    });
  });
  refreshEverything();
  return { ok: true };
}

/* -------------------------------------------------------------- meetings -- */

export async function updateMeeting(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = meetingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "That could not be saved" };
  const { periodType, periodStart, step, discussed, notes } = parsed.data;

  const [existing] = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.householdId, session.householdId),
        eq(meetings.periodType, periodType),
        eq(meetings.periodStart, periodStart),
      ),
    )
    .limit(1);

  const nextDiscussed = { ...(existing?.discussed ?? {}) };
  if (step !== undefined) nextDiscussed[String(step)] = Boolean(discussed);

  if (existing) {
    await db
      .update(meetings)
      .set({
        discussed: nextDiscussed,
        notes: notes !== undefined ? notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, existing.id));
  } else {
    await db.insert(meetings).values({
      householdId: session.householdId,
      periodType,
      periodStart,
      discussed: nextDiscussed,
      notes: notes ?? null,
    });
  }

  refreshEverything();
  return { ok: true };
}

export async function markActivitySeen(): Promise<ActionResult> {
  const session = await requireSession();
  await markSeen(session.user.id);
  refreshEverything();
  return { ok: true };
}

/**
 * "Next week" tasks whose week has arrived become "This week". Called when the
 * app loads, so it is correct whenever anyone opens it and needs no scheduler.
 */
export async function rollForwardSlots(itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;
  const session = await requireSession();
  await db.transaction(async (tx) => {
    for (const itemId of itemIds) {
      await tx
        .update(items)
        .set({ slot: "This week", slotWeek: null, updatedAt: new Date() })
        .where(and(eq(items.id, itemId), eq(items.householdId, session.householdId)));
      await tx.insert(itemEvents).values({
        householdId: session.householdId,
        itemId,
        type: "system",
        summary: "rolled into this week",
      });
    }
  });
}
