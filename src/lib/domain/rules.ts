/**
 * The rules that make the weekly meeting work. Pure functions over plain item
 * shapes, so every one of them is unit-tested without a database.
 */

import { isDone, type Kind, type Slot } from "./kinds";
import { addDays, inWindow, today, weekEnd, weeksBetween, weekStart } from "./week";
import { sumCents, toCents, type Cents } from "./money";

export interface ItemLike {
  id: string;
  kind: Kind;
  title: string;
  who: string | null;
  dueDate: string | null;
  amount: string | number | null;
  status: string | null;
  stage: string | null;
  slot: string | null;
  slotWeek: string | null;
  section: string | null;
  linkedItemId: string | null;
  createdAt: string;
  receivedDate?: string | null;
  actual?: string | number | null;
  confidence?: string | null;
  stream?: string | null;
  projectId?: string | null;
  reimbursed?: string | number | null;
  /** "Once" | "Monthly" | "Annually" — drives the expense run-rate. */
  repeat?: string | null;
  /** "Need" | "Want" — the lever you control on the Freedom Score. */
  need?: string | null;
  archivedAt?: string | null;
}

const byDueDate = (a: ItemLike, b: ItemLike) =>
  (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");

export const sortByDue = (items: ItemLike[]) => [...items].sort(byDueDate);

/* ------------------------------------------------------------------ tasks -- */

/**
 * Anything not done that was created before this week's Friday, or was due before
 * it. Nothing is copied: this is a view, computed fresh every time.
 */
export function carriedOver(items: ItemLike[], now = today()): ItemLike[] {
  const start = weekStart(now);
  return sortByDue(
    items.filter(
      (item) =>
        item.kind === "task" &&
        !item.archivedAt &&
        !isDone(item) &&
        (item.createdAt.slice(0, 10) < start || (item.dueDate !== null && item.dueDate < start)),
    ),
  );
}

/** Tasks for the current week, excluding ones already shown as carried over. */
export function dueThisWeek(items: ItemLike[], now = today()): ItemLike[] {
  const start = weekStart(now);
  const end = weekEnd(now);
  const carried = new Set(carriedOver(items, now).map((item) => item.id));
  return sortByDue(
    items.filter(
      (item) =>
        item.kind === "task" &&
        !item.archivedAt &&
        !isDone(item) &&
        !carried.has(item.id) &&
        (inWindow(item.dueDate, start, end) || item.slot === "This week"),
    ),
  );
}

export function inSlot(items: ItemLike[], slot: Slot): ItemLike[] {
  return sortByDue(
    items.filter(
      (item) => item.kind === "task" && !item.archivedAt && !isDone(item) && item.slot === slot,
    ),
  );
}

/**
 * A "Next week" task whose slot was set in an earlier week has arrived: it becomes
 * "This week". Returns the ids to roll, so the caller can write them and log the
 * move. Runs on read, so it is correct whenever anyone opens the app.
 */
export function dueForRollover(items: ItemLike[], now = today()): ItemLike[] {
  const start = weekStart(now);
  return items.filter(
    (item) =>
      item.kind === "task" &&
      !item.archivedAt &&
      !isDone(item) &&
      item.slot === "Next week" &&
      item.slotWeek !== null &&
      item.slotWeek < start,
  );
}

/** The default due date for a task created in a given slot. */
export function defaultDueDate(slot: Slot, now = today()): string | null {
  if (slot === "This week") return weekEnd(now);
  if (slot === "Next week") return addDays(weekStart(now), 13);
  return null;
}

export function weeksCarried(item: ItemLike, now = today()): number {
  return weeksBetween(item.createdAt.slice(0, 10), now);
}

/* ------------------------------------------------------------------ money -- */

export interface CashOut {
  rows: ItemLike[];
  parts: Record<string, Cents>;
  total: Cents;
}

/**
 * Cash required over the next 30 days. The inclusion rules are per kind and are
 * the single place this is decided; see the build brief, Business rules.
 */
export function cashRequired(items: ItemLike[], now = today(), days = 30): CashOut {
  const end = addDays(now, days);
  const parts: Record<string, Cents> = {
    Bills: 0, "Once-off": 0, Maintenance: 0, Projects: 0,
    Medical: 0, Sowing: 0, Experiences: 0, Tasks: 0,
  };
  const rows: ItemLike[] = [];

  for (const item of items) {
    if (item.archivedAt || !item.dueDate || item.dueDate > end || isDone(item)) continue;
    const cents = toCents(item.amount);
    if (!cents) continue;

    const bucket = ((): string | null => {
      switch (item.kind) {
        case "bill": return "Bills";
        case "onceoff": return item.status === "Considering" ? null : "Once-off";
        case "maintenance":
          return item.status === "Needs Action" || item.status === "Booked" ? "Maintenance" : null;
        case "projectexp":
          return item.status === "Quoted" || item.status === "Approved" ? "Projects" : null;
        case "medical": return item.status === "To pay" ? "Medical" : null;
        case "sowing": return item.status === "Committed" ? "Sowing" : null;
        case "experience": return item.stage === "Booked" ? "Experiences" : null;
        // A task created from another item would double count its parent's amount.
        case "task": return item.linkedItemId ? null : "Tasks";
        default: return null;
      }
    })();

    if (!bucket) continue;
    parts[bucket] += cents;
    rows.push(item);
  }

  return {
    rows: sortByDue(rows),
    parts,
    total: Object.values(parts).reduce((a, b) => a + b, 0),
  };
}

export interface IncomeWindow {
  rows: ItemLike[];
  firm: ItemLike[];
  possible: ItemLike[];
  total: Cents;
  possibleTotal: Cents;
}

/** Income expected in the window. "Possible" is shown but never counted. */
export function incomeWindow(items: ItemLike[], now = today(), days = 30): IncomeWindow {
  const end = addDays(now, days);
  const rows = sortByDue(
    items.filter(
      (item) =>
        item.kind === "income" &&
        !item.archivedAt &&
        !isDone(item) &&
        (item.dueDate === null || item.dueDate <= end),
    ),
  );
  const firm = rows.filter((item) => item.confidence !== "Possible");
  const possible = rows.filter((item) => item.confidence === "Possible");
  return {
    rows,
    firm,
    possible,
    total: sumCents(firm.map((item) => item.amount)),
    possibleTotal: sumCents(possible.map((item) => item.amount)),
  };
}

export interface IncomeSplit {
  active: Cents;
  passive: Cents;
  total: Cents;
}

/** Active against passive, on whatever set of income rows is handed in. */
export function incomeSplit(rows: ItemLike[]): IncomeSplit {
  const value = (item: ItemLike) => toCents(item.actual ?? item.amount);
  const active = rows
    .filter((item) => item.stream !== "Passive")
    .reduce((total, item) => total + value(item), 0);
  const passive = rows
    .filter((item) => item.stream === "Passive")
    .reduce((total, item) => total + value(item), 0);
  return { active, passive, total: active + passive };
}

/* --------------------------------------------------------------- projects -- */

export interface ProjectTotals {
  budget: Cents;
  committed: Cents;
  paid: Cents;
  overBudget: boolean;
  percentUsed: number;
}

export function projectTotals(project: ItemLike, costs: ItemLike[]): ProjectTotals {
  const mine = costs.filter((cost) => cost.projectId === project.id && !cost.archivedAt);
  const budget = toCents(project.amount);
  const committed = sumCents(mine.map((cost) => cost.amount));
  const paid = sumCents(mine.filter((cost) => cost.status === "Paid").map((cost) => cost.amount));
  return {
    budget,
    committed,
    paid,
    overBudget: budget > 0 && committed > budget,
    percentUsed: budget > 0 ? Math.min(100, Math.round((committed / budget) * 100)) : 0,
  };
}

/* ---------------------------------------------------------------- medical -- */

export interface MedicalTotals {
  outstanding: Cents;
  paidThisYear: Cents;
  reimbursedThisYear: Cents;
  outOfPocket: Cents;
}

export function medicalTotals(items: ItemLike[], now = today()): MedicalTotals {
  const year = now.slice(0, 4);
  const mine = items.filter((item) => item.kind === "medical" && !item.archivedAt);
  const thisYear = mine.filter((item) => (item.dueDate ?? "").startsWith(year));
  const paidThisYear = sumCents(
    thisYear.filter((item) => item.status !== "To pay").map((item) => item.amount),
  );
  const reimbursedThisYear = sumCents(thisYear.map((item) => item.reimbursed));
  return {
    outstanding: sumCents(
      mine.filter((item) => item.status === "To pay").map((item) => item.amount),
    ),
    paidThisYear,
    reimbursedThisYear,
    outOfPocket: paidThisYear - reimbursedThisYear,
  };
}

/* ------------------------------------------------------------------ bills -- */

/**
 * A repeating bill marked Paid spawns its next occurrence, once. The caller
 * guards on `spawnedId` so a double save cannot create two.
 */
export function nextOccurrence(
  bill: { dueDate: string | null; repeat: string | null },
): string | null {
  if (!bill.dueDate || !bill.repeat || bill.repeat === "Once") return null;
  const months = bill.repeat === "Annually" ? 12 : 1;
  const [y, m, d] = bill.dueDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
