/**
 * The shape of each drive.
 *
 * The order of a drive is a decision, not a constant. These are conversations,
 * and the one that always starts in the same place stops being one. Each step
 * carries a stable id, so a tick follows its step when the step moves rather than
 * following the number it happened to sit on.
 */

import type { PeriodType } from "./week";

export interface DriveStep {
  id: string;
  title: string;
  hint: string;
}

export const DRIVE_STEPS: Record<PeriodType, readonly DriveStep[]> = {
  week: [
    { id: "lastweek", title: "Unfinished from last week", hint: "Anything not done rolls in here automatically, with its original owner, date and amount." },
    { id: "thisweek", title: "This week", hint: "Agree who does what before next Friday." },
    { id: "income", title: "Income & cash flow", hint: "Expected money in against money going out over the next 30 days." },
    { id: "home", title: "Needs & wants", hint: "Budget lines, once-off costs and medical due in the next 30 days, and anything in the house that needs action." },
    { id: "kingdom", title: "Kingdom", hint: "Prayer, sowing and where it is hard to believe." },
    { id: "deals", title: "Assets & deals", hint: "Anything that needs a decision or a next step this week." },
    { id: "experiences", title: "Experiences", hint: "Holidays, outings and things to look forward to." },
    { id: "decisions", title: "Decisions made", hint: "Record what you agreed so it can be found later." },
  ],
  month: [
    { id: "parked", title: "Parked for this drive", hint: "Everything you agreed to think about together, rather than rush in a weekly." },
    { id: "goals", title: "Goals", hint: "Are you closer than a month ago? Move the status, or add the next step." },
    { id: "business", title: "Business goals", hint: "The steps agreed on each business goal — what moved, and what changes this month?" },
    { id: "numbers", title: "The month in numbers", hint: "What actually came in and went out this month." },
    { id: "focus", title: "Focus & decisions", hint: "What matters most in the month ahead." },
  ],
  quarter: [
    { id: "numbers", title: "The quarter in numbers", hint: "What actually came in and went out across the three months." },
    { id: "goals", title: "Goals & strategy", hint: "Three months is long enough to tell the difference between slow and stuck." },
    { id: "assets", title: "Assets, deals and experiences", hint: "What moved in the pipeline, and what you actually did as a family." },
    { id: "focus", title: "Focus & decisions for next quarter", hint: "One or two things, not ten. Write down what you agreed." },
  ],
  year: [
    { id: "numbers", title: "The year in numbers", hint: "Twelve months of what came in, what went out, and what was left." },
    { id: "goals", title: "Goals achieved", hint: "Read them out. A year of small moves looks like nothing in a week and a lot in twelve months." },
    { id: "strategy", title: "Strategy for the year ahead", hint: "What changes, what stops, and what you are no longer going to pretend is working." },
    { id: "assets", title: "Assets, deals and experiences", hint: "What you own, what you are looking at, and what you actually did together." },
    { id: "decisions", title: "Decisions & the year ahead", hint: "The few things that would make next year different." },
  ],
};

/** The household's saved order for each cadence. Absent means "all of them". */
export type DriveOrder = Partial<Record<PeriodType, string[]>>;

export const driveIds = (p: PeriodType): string[] => DRIVE_STEPS[p].map((s) => s.id);

/**
 * The positions as they shipped, including steps since retired. A tick taken
 * before steps had ids was stored as its number, so converting it needs the list
 * that was on screen at the time — not today's. The Freedom Score was step 2 of
 * the quarterly and annual reviews before it was removed; without it here, every
 * tick after it would quietly slide onto the wrong step.
 */
const LEGACY_IDS: Partial<Record<PeriodType, string[]>> = {
  quarter: ["numbers", "freedom", "goals", "assets", "focus"],
  year: ["numbers", "freedom", "goals", "strategy", "assets", "decisions"],
};
export const driveStep = (p: PeriodType, id: string): DriveStep | undefined =>
  DRIVE_STEPS[p].find((s) => s.id === id);
export const driveLabel = (p: PeriodType, id: string): string => driveStep(p, id)?.title ?? id;

/**
 * The saved order, cleaned of anything that no longer exists. Falls back to the
 * full list, so a household that has never touched this sees every step.
 */
export function driveOrder(p: PeriodType, saved?: DriveOrder | null): string[] {
  const ids = driveIds(p);
  const keep = Array.isArray(saved?.[p]) ? saved![p]!.filter((id) => ids.includes(id)) : null;
  return keep && keep.length ? keep : ids;
}

/** Steps the household has taken out of this cadence. */
export function driveOff(p: PeriodType, saved?: DriveOrder | null): string[] {
  const on = driveOrder(p, saved);
  return driveIds(p).filter((id) => !on.includes(id));
}

export type MoveAction = "up" | "down" | "remove" | "add";

/**
 * The new order after a move, or null when the move is not possible. Returns the
 * string "last" when the move would empty the drive, which the caller reports
 * rather than silently refusing.
 */
export function moveStep(
  p: PeriodType,
  id: string,
  act: MoveAction,
  saved?: DriveOrder | null,
): string[] | null | "last" {
  const order = driveOrder(p, saved).slice();
  const i = order.indexOf(id);

  if (act === "up") {
    if (i <= 0) return null;
    order.splice(i, 1);
    order.splice(i - 1, 0, id);
  } else if (act === "down") {
    if (i < 0 || i >= order.length - 1) return null;
    order.splice(i, 1);
    order.splice(i + 1, 0, id);
  } else if (act === "remove") {
    if (i < 0) return null;
    if (order.length <= 1) return "last";
    order.splice(i, 1);
  } else if (act === "add") {
    if (i >= 0) return null;
    if (!driveIds(p).includes(id)) return null;
    // Slot it back beside the step it normally follows, without disturbing the
    // order the household has chosen for everything else. Re-sorting the whole
    // list here would quietly undo their arrangement.
    const ids = driveIds(p);
    const at = ids.indexOf(id);
    let pos = 0;
    for (let k = at - 1; k >= 0; k -= 1) {
      const j = order.indexOf(ids[k]);
      if (j >= 0) { pos = j + 1; break; }
    }
    order.splice(pos, 0, id);
  } else {
    return null;
  }
  return order;
}

/** 1-based position on screen, or 0 when the step is not in this drive. */
export function stepPos(p: PeriodType, id: string, saved?: DriveOrder | null): number {
  const i = driveOrder(p, saved).indexOf(id);
  return i < 0 ? 0 : i + 1;
}

export function howManyDiscussed(
  p: PeriodType,
  discussed: Record<string, boolean> | null | undefined,
  saved?: DriveOrder | null,
): { done: number; total: number } {
  const order = driveOrder(p, saved);
  const d = discussed ?? {};
  return { done: order.filter((id) => d[id]).length, total: order.length };
}

/**
 * Older meetings ticked steps by number. Carry those ticks onto the ids they were
 * sitting on, or a reorder would silently move them to the wrong step. Returns
 * null when there is nothing to change.
 */
export function remapDiscussed(
  p: PeriodType,
  discussed: Record<string, boolean> | null | undefined,
): Record<string, boolean> | null {
  if (!discussed) return null;
  const ids = LEGACY_IDS[p] ?? driveIds(p);
  const live = new Set(driveIds(p));
  const out: Record<string, boolean> = {};
  let changed = false;
  for (const key of Object.keys(discussed)) {
    if (/^\d+$/.test(key)) {
      const id = ids[Number(key) - 1];
      // A tick on a step that no longer exists is dropped, not moved onto its
      // neighbour.
      if (id) { changed = true; if (live.has(id)) out[id] = discussed[key]; }
    } else {
      out[key] = discussed[key];
    }
  }
  return changed ? out : null;
}

/**
 * Everything a step header needs, taken from one place: the step's number comes
 * from where the household put it, and its title from the step itself, so a
 * page never carries its own copy of either.
 */
export function stepProps(p: PeriodType, id: string, saved?: DriveOrder | null) {
  const def = driveStep(p, id);
  return {
    n: stepPos(p, id, saved),
    stepId: id,
    title: def?.title ?? id,
    hint: def?.hint,
    periodType: p,
  };
}
