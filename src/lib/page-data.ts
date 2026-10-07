import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemLinks, items as itemsTable } from "@/lib/db/schema";
import {
  allItems, getHousehold, latestNotes, stepCounts, toItemLike,
} from "@/lib/db/queries";
import { requireSession } from "@/lib/auth";
import type { RowExtras } from "@/lib/view";

/**
 * Every screen is a view over the same small set of items, so one loader serves
 * them all: the items, plus the bits each row needs to show movement.
 */
export const loadScreen = cache(async function loadScreen() {
  const session = await requireSession();
  const householdId = session.householdId;

  const [household, items, notes, steps, linkRows] = await Promise.all([
    getHousehold(householdId),
    allItems(householdId),
    latestNotes(householdId),
    stepCounts(householdId),
    db
      .select({ itemId: itemLinks.itemId, count: sql<number>`count(*)::int` })
      .from(itemLinks)
      .innerJoin(itemsTable, eq(itemsTable.id, itemLinks.itemId))
      .where(eq(itemsTable.householdId, householdId))
      .groupBy(itemLinks.itemId),
  ]);

  const extras: RowExtras = {
    names: household?.personNames ?? {},
    notes,
    steps,
    linkCounts: new Map(linkRows.map((row) => [row.itemId, row.count])),
  };

  return {
    session,
    householdId,
    household,
    items,
    likes: items.map(toItemLike),
    extras,
    byId: new Map(items.map((item) => [item.id, item])),
  };
});

export type ScreenData = Awaited<ReturnType<typeof loadScreen>>;

/** Turns domain results (ItemLike) back into the database rows the view needs. */
export function pick(screen: ScreenData, list: Array<{ id: string }>) {
  return list.map((entry) => screen.byId.get(entry.id)!).filter(Boolean);
}
