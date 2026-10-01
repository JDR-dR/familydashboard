"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemEvents, itemLinks, itemSteps, items, users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth";
import { getHousehold } from "@/lib/db/queries";
import type { Kind } from "@/lib/domain/kinds";

export interface DrawerEvent {
  id: string;
  type: string;
  summary: string | null;
  body: string | null;
  at: string;
  who: string | null;
}

export interface DrawerItem {
  id: string | null;
  kind: Kind;
  title: string;
  who: string | null;
  dueDate: string | null;
  amount: string | null;
  status: string | null;
  stage: string | null;
  section: string | null;
  slot: string | null;
  nextStep: string | null;
  notes: string | null;
  category: string | null;
  projectId: string | null;
  data: Record<string, string>;
  steps: Array<{ text: string; done: boolean }>;
  links: Array<{ url: string; label: string | null }>;
  events: DrawerEvent[];
  createdAt: string | null;
  doneAt: string | null;
  projects: Array<{ id: string; title: string }>;
  personNames: Record<string, string>;
}

/** Loads one item for the drawer, or the defaults for a new one. */
export async function loadDrawerItem(
  id: string | null,
  kind: Kind | null,
  presets: Record<string, string> = {},
): Promise<DrawerItem | null> {
  const session = await requireSession();
  const household = await getHousehold(session.householdId);
  const personNames = household?.personNames ?? {};

  const projectRows = await db
    .select({ id: items.id, title: items.title })
    .from(items)
    .where(and(eq(items.householdId, session.householdId), eq(items.kind, "project")));

  if (!id) {
    if (!kind) return null;
    return {
      id: null,
      kind,
      title: "",
      who: presets.who ?? null,
      dueDate: null,
      amount: null,
      status: null,
      stage: null,
      section: presets.section ?? null,
      slot: presets.slot ?? null,
      nextStep: null,
      notes: null,
      category: presets.category ?? null,
      projectId: presets.projectId ?? null,
      data: presets.type ? { type: presets.type } : {},
      steps: [],
      links: [],
      events: [],
      createdAt: null,
      doneAt: null,
      projects: projectRows,
      personNames,
    };
  }

  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.householdId, session.householdId)))
    .limit(1);
  if (!item) return null;

  const [steps, links, events] = await Promise.all([
    db.select().from(itemSteps).where(eq(itemSteps.itemId, id)).orderBy(itemSteps.position),
    db.select().from(itemLinks).where(eq(itemLinks.itemId, id)).orderBy(itemLinks.position),
    db
      .select({
        id: itemEvents.id,
        type: itemEvents.type,
        summary: itemEvents.summary,
        body: itemEvents.body,
        createdAt: itemEvents.createdAt,
        who: users.name,
      })
      .from(itemEvents)
      .leftJoin(users, eq(users.id, itemEvents.userId))
      .where(eq(itemEvents.itemId, id))
      .orderBy(desc(itemEvents.createdAt))
      .limit(25),
  ]);

  const data = item.data as Record<string, unknown>;
  const stringData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) stringData[key] = String(value);
  }

  return {
    id: item.id,
    kind: item.kind as Kind,
    title: item.title,
    who: item.who,
    dueDate: item.dueDate,
    amount: item.amount,
    status: item.status,
    stage: item.stage,
    section: item.section,
    slot: item.slot,
    nextStep: item.nextStep,
    notes: item.notes,
    category: item.category,
    projectId: item.projectId,
    data: stringData,
    steps: steps.map((step) => ({ text: step.text, done: step.done })),
    links: links.map((link) => ({ url: link.url, label: link.label })),
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      summary: event.summary,
      body: event.body,
      at: event.createdAt.toISOString(),
      who: event.who,
    })),
    createdAt: item.createdAt.toISOString(),
    doneAt: item.doneAt,
    projects: projectRows,
    personNames,
  };
}
