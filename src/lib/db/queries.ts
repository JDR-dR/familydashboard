import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "./index";
import {
  freedomScores, households, itemEvents, itemLinks, itemSteps, items, meetings,
  seenMarkers, users,
  type Item, type ItemEvent, type ItemLink, type ItemStep,
} from "./schema";
import type { ItemLike } from "@/lib/domain/rules";
import type { Kind } from "@/lib/domain/kinds";
import type { PeriodType } from "@/lib/domain/week";

/**
 * Every function here takes a householdId as its first argument, and every query
 * filters on it. The id comes from the session on the server, never the client.
 */

export type ItemRow = Item & {
  steps: ItemStep[];
  links: ItemLink[];
  lastNote: ItemEvent | null;
  lastEvent: ItemEvent | null;
};

/** The shape the pure domain functions expect. */
export function toItemLike(item: Item): ItemLike {
  const data = item.data as Record<string, unknown>;
  return {
    id: item.id,
    kind: item.kind as Kind,
    title: item.title,
    who: item.who,
    dueDate: item.dueDate,
    amount: item.amount,
    status: item.status,
    stage: item.stage,
    slot: item.slot,
    slotWeek: item.slotWeek,
    section: item.section,
    linkedItemId: item.linkedItemId,
    projectId: item.projectId,
    createdAt: item.createdAt.toISOString(),
    archivedAt: item.archivedAt ? item.archivedAt.toISOString() : null,
    receivedDate: (data.receivedDate as string | undefined) ?? null,
    actual: (data.actual as string | undefined) ?? null,
    confidence: (data.confidence as string | undefined) ?? null,
    stream: (data.stream as string | undefined) ?? null,
    reimbursed: (data.reimbursed as string | undefined) ?? null,
    repeat: (data.repeat as string | undefined) ?? null,
    need: (data.need as string | undefined) ?? null,
  };
}

/** Every live item for the household. The dataset is small; one read serves a screen. */
export const allItems = cache(async function allItems(householdId: string): Promise<Item[]> {
  return db
    .select()
    .from(items)
    .where(and(eq(items.householdId, householdId), isNull(items.archivedAt)))
    .orderBy(asc(items.dueDate));
});

export async function itemsOfKind(householdId: string, kinds: Kind[]): Promise<Item[]> {
  return db
    .select()
    .from(items)
    .where(
      and(
        eq(items.householdId, householdId),
        isNull(items.archivedAt),
        inArray(items.kind, kinds),
      ),
    )
    .orderBy(asc(items.dueDate));
}

export async function getItem(householdId: string, id: string): Promise<ItemRow | null> {
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.householdId, householdId), eq(items.id, id)))
    .limit(1);
  if (!item) return null;

  const [steps, links, events] = await Promise.all([
    db.select().from(itemSteps).where(eq(itemSteps.itemId, id)).orderBy(asc(itemSteps.position)),
    db.select().from(itemLinks).where(eq(itemLinks.itemId, id)).orderBy(asc(itemLinks.position)),
    db.select().from(itemEvents).where(eq(itemEvents.itemId, id)).orderBy(desc(itemEvents.createdAt)).limit(25),
  ]);

  return {
    ...item,
    steps,
    links,
    lastNote: events.find((event) => event.type === "note") ?? null,
    lastEvent: events[0] ?? null,
  };
}

/** The sub-line on every row: the latest note, so carried work visibly moves. */
export const latestNotes = cache(async function latestNotes(
  householdId: string,
): Promise<Map<string, { body: string; createdAt: Date; userName: string | null }>> {
  const rows = await db
    .select({
      itemId: itemEvents.itemId,
      body: itemEvents.body,
      createdAt: itemEvents.createdAt,
      userName: users.name,
    })
    .from(itemEvents)
    .leftJoin(users, eq(users.id, itemEvents.userId))
    .where(and(eq(itemEvents.householdId, householdId), eq(itemEvents.type, "note")))
    .orderBy(desc(itemEvents.createdAt))
    .limit(400);

  const map = new Map<string, { body: string; createdAt: Date; userName: string | null }>();
  for (const row of rows) {
    if (!row.body || map.has(row.itemId)) continue;
    map.set(row.itemId, { body: row.body, createdAt: row.createdAt, userName: row.userName });
  }
  return map;
});

export const stepCounts = cache(async function stepCounts(householdId: string): Promise<Map<string, { done: number; total: number }>> {
  const rows = await db
    .select({
      itemId: itemSteps.itemId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${itemSteps.done})::int`,
    })
    .from(itemSteps)
    .innerJoin(items, eq(items.id, itemSteps.itemId))
    .where(eq(items.householdId, householdId))
    .groupBy(itemSteps.itemId);
  return new Map(rows.map((row) => [row.itemId, { done: row.done, total: row.total }]));
});

export interface FeedEntry {
  id: string;
  itemId: string;
  itemTitle: string;
  itemKind: string;
  type: string;
  summary: string | null;
  body: string | null;
  createdAt: Date;
  userId: string | null;
  userName: string | null;
}

export async function activityFeed(householdId: string, limit = 80): Promise<FeedEntry[]> {
  return db
    .select({
      id: itemEvents.id,
      itemId: itemEvents.itemId,
      itemTitle: items.title,
      itemKind: items.kind,
      type: itemEvents.type,
      summary: itemEvents.summary,
      body: itemEvents.body,
      createdAt: itemEvents.createdAt,
      userId: itemEvents.userId,
      userName: users.name,
    })
    .from(itemEvents)
    .innerJoin(items, eq(items.id, itemEvents.itemId))
    .leftJoin(users, eq(users.id, itemEvents.userId))
    .where(eq(itemEvents.householdId, householdId))
    .orderBy(desc(itemEvents.createdAt))
    .limit(limit);
}

/**
 * The two numbers the sidebar needs, as one query each, instead of loading every
 * item on every navigation just to count a badge.
 */
export const navCounts = cache(async function navCounts(
  householdId: string,
  weekStartDate: string,
): Promise<{ carried: number; rollover: string[] }> {
  const [carriedRow, rollRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.kind, "task"),
          isNull(items.archivedAt),
          isNull(items.doneAt),
          or(
            sql`${items.createdAt} < ${weekStartDate}::date`,
            sql`${items.dueDate} < ${weekStartDate}::date`,
          ),
        ),
      ),
    db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.householdId, householdId),
          eq(items.kind, "task"),
          isNull(items.archivedAt),
          isNull(items.doneAt),
          eq(items.slot, "Next week"),
          sql`${items.slotWeek} < ${weekStartDate}::date`,
        ),
      ),
  ]);
  return { carried: carriedRow[0]?.count ?? 0, rollover: rollRows.map((row) => row.id) };
});

export const unseenCount = cache(async function unseenCount(householdId: string, userId: string): Promise<number> {
  const [marker] = await db
    .select()
    .from(seenMarkers)
    .where(eq(seenMarkers.userId, userId))
    .limit(1);
  const since = marker?.lastSeenAt ?? new Date(0);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(itemEvents)
    .where(
      and(
        eq(itemEvents.householdId, householdId),
        gte(itemEvents.createdAt, since),
        or(isNull(itemEvents.userId), sql`${itemEvents.userId} <> ${userId}`),
      ),
    );
  return row?.count ?? 0;
});

export async function markSeen(userId: string): Promise<void> {
  await db
    .insert(seenMarkers)
    .values({ userId, lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: seenMarkers.userId, set: { lastSeenAt: new Date() } });
}

export async function getMeeting(
  householdId: string,
  periodType: PeriodType,
  periodStart: string,
) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.householdId, householdId),
        eq(meetings.periodType, periodType),
        eq(meetings.periodStart, periodStart),
      ),
    )
    .limit(1);
  return meeting ?? null;
}

export async function lastMonthlyDrive(householdId: string) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.householdId, householdId), eq(meetings.periodType, "month")))
    .orderBy(desc(meetings.periodStart))
    .limit(1);
  return meeting ?? null;
}

export const getHousehold = cache(async function getHousehold(householdId: string) {
  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);
  return household ?? null;
});

export async function householdUsers(householdId: string) {
  return db
    .select()
    .from(users)
    .where(and(eq(users.householdId, householdId), isNull(users.archivedAt)))
    .orderBy(asc(users.createdAt));
}

/**
 * Every Financial Freedom Score reading for the household, oldest first, which is
 * the order the trend functions expect.
 */
export const freedomHistory = cache(async function freedomHistory(householdId: string) {
  return db
    .select()
    .from(freedomScores)
    .where(eq(freedomScores.householdId, householdId))
    .orderBy(asc(freedomScores.periodStart));
});
