/**
 * The Financial Freedom Score.
 *
 * High income does not equal freedom. The traditional plan rests on three things
 * nobody controls — the growth rate, future tax rates, and the market in the year
 * you start drawing down — and the experts cannot agree on the safe withdrawal
 * rate to within a hundred thousand a year on the same account.
 *
 * So this is the replacement scoreboard: passive income divided by what you spend
 * in a month. It is the only scoreboard where you control both sides. You decide
 * what you spend, and you decide what kind of investor you become. It starts
 * paying you with the very first rand, and at 100% the money that arrives without
 * you covers the life you have chosen.
 *
 * Pure functions over plain shapes, like everything else in this folder.
 */

import { isDone, KIND_DEFS, type NeedWant } from "./kinds";
import type { ItemLike } from "./rules";
import type { Cents } from "./money";
import { toCents } from "./money";
import { addDays, today } from "./week";

/* ------------------------------------------------------- what you spend ---- */

/** A need or a want, falling back to the kind's default for older records. */
export function needOf(item: ItemLike): NeedWant {
  if (item.need === "Want") return "Want";
  if (item.need === "Need") return "Need";
  return (KIND_DEFS[item.kind]?.defaults.need as NeedWant | undefined) ?? "Need";
}

export interface RunRate {
  needs: Cents;
  wants: Cents;
  total: Cents;
  rows: ItemLike[];
}

/**
 * The recurring monthly expense run-rate, read off the records: a monthly bill at
 * face value, an annual bill spread over twelve. Once-off costs and maintenance
 * are deliberately left out — they are lumpy, not a run-rate, and padding the
 * denominator with them would flatter nothing and mislead everything. Only live
 * bills count, so a paid bill and the occurrence it spawned never count twice.
 */
export function expenseRunRate(items: ItemLike[]): RunRate {
  let needs = 0;
  let wants = 0;
  const rows: ItemLike[] = [];

  for (const item of items) {
    if (item.kind !== "bill" || item.archivedAt || isDone(item)) continue;
    const repeat = item.repeat;
    if (repeat !== "Monthly" && repeat !== "Annually") continue;

    const cents = toCents(item.amount);
    if (!cents) continue;
    const monthly = repeat === "Annually" ? Math.round(cents / 12) : cents;

    if (needOf(item) === "Want") wants += monthly;
    else needs += monthly;
    rows.push(item);
  }

  return { needs, wants, total: needs + wants, rows };
}

/** What the household has typed in as its real monthly spend, either side optional. */
export interface Baseline {
  needs: Cents | null;
  wants: Cents | null;
}

export interface MonthlyExpenses {
  needs: Cents;
  wants: Cents;
  total: Cents;
  needsFromBaseline: boolean;
  wantsFromBaseline: boolean;
  runRate: RunRate;
}

/**
 * What you spend in a month: the typed-in baseline where there is one, the
 * run-rate from the records otherwise. Each side is independent, so you can pin
 * the needs figure and still let wants follow the bills.
 */
export function monthlyExpenses(
  items: ItemLike[],
  baseline: Baseline = { needs: null, wants: null },
): MonthlyExpenses {
  const runRate = expenseRunRate(items);
  const needs = baseline.needs ?? runRate.needs;
  const wants = baseline.wants ?? runRate.wants;
  return {
    needs,
    wants,
    total: needs + wants,
    needsFromBaseline: baseline.needs !== null,
    wantsFromBaseline: baseline.wants !== null,
    runRate,
  };
}

/* ------------------------------------------------- what pays you anyway ---- */

export interface PassiveIncome {
  monthly: Cents;
  rows: ItemLike[];
}

/**
 * Passive income over the next 30 days: everything that pays you without you
 * actively working for it. A rental property. A private loan. A business run by
 * another operator. Royalties. Anything only "Possible" is left out, because a
 * score built on money that might not arrive is not a score.
 */
export function passiveMonthly(
  items: ItemLike[],
  now: string = today(),
  days = 30,
): PassiveIncome {
  const end = addDays(now, days);
  const rows = items.filter(
    (item) =>
      item.kind === "income" &&
      item.stream === "Passive" &&
      !item.archivedAt &&
      !isDone(item) &&
      item.confidence !== "Possible" &&
      (item.dueDate === null || item.dueDate <= end),
  );
  return {
    monthly: rows.reduce((total, item) => total + toCents(item.amount), 0),
    rows,
  };
}

/* ------------------------------------------------------------ the score ---- */

export interface FreedomScore {
  /** Monthly passive income — the numerator. */
  passive: Cents;
  needs: Cents;
  wants: Cents;
  /** Needs plus wants — the denominator. */
  expenses: Cents;
  /** The headline: passive income as a percentage of everything you spend. */
  score: number;
  /** Against needs alone — the first line worth crossing. */
  needsScore: number;
  /** What is still missing every month to reach 100%. */
  gap: Cents;
  needsGap: Cents;
  free: boolean;
  needsCovered: boolean;
}

/** Unrounded, so one rand of passive income never reads as zero per cent. */
function ratio(part: Cents, whole: Cents): number {
  if (whole <= 0) return part > 0 ? 100 : 0;
  const raw = (part / whole) * 100;
  if (raw > 0 && raw < 1) return 1;
  return Math.round(raw);
}

export function freedomScore(passive: Cents, expenses: MonthlyExpenses): FreedomScore {
  return {
    passive,
    needs: expenses.needs,
    wants: expenses.wants,
    expenses: expenses.total,
    score: ratio(passive, expenses.total),
    needsScore: ratio(passive, expenses.needs),
    gap: Math.max(0, expenses.total - passive),
    needsGap: Math.max(0, expenses.needs - passive),
    free: expenses.total > 0 && passive >= expenses.total,
    needsCovered: expenses.needs > 0 && passive >= expenses.needs,
  };
}

export interface FreedomBand {
  label: string;
  blurb: string;
}

/** One place decides what a score is called, so every screen agrees. */
export function freedomBand(score: number): FreedomBand {
  if (score >= 100)
    return {
      label: "Financially free",
      blurb:
        "Passive income covers the life you have chosen. It does not need you in the room.",
    };
  if (score >= 75)
    return { label: "Within reach", blurb: "The last stretch is the shortest one." };
  if (score >= 50)
    return { label: "Halfway there", blurb: "Half your life is already paid for without you." };
  if (score >= 25)
    return {
      label: "A quarter of the way",
      blurb: "Not nought per cent retired. A quarter of the way to freedom.",
    };
  if (score >= 1)
    return { label: "On the board", blurb: "The scoreboard pays you from the first rand." };
  return {
    label: "Not on the board yet",
    blurb: "One rental, one loan, one dividend and the score starts moving.",
  };
}

/* ---------------------------------------------------------- keeping score -- */

/** One stored reading of the score, taken at a month start. */
export interface ScoreSnapshot {
  periodStart: string;
  passive: Cents;
  needs: Cents;
  wants: Cents;
  score: number;
}

export interface ScoreMovement {
  /** Points gained since the previous reading. Negative when it slipped. */
  points: number;
  passive: Cents;
  expenses: Cents;
  previous: ScoreSnapshot | null;
}

/** History oldest first. Compares the last two readings. */
export function scoreMovement(history: ScoreSnapshot[]): ScoreMovement {
  if (history.length < 2) return { points: 0, passive: 0, expenses: 0, previous: null };
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  return {
    points: latest.score - previous.score,
    passive: latest.passive - previous.passive,
    expenses: latest.needs + latest.wants - (previous.needs + previous.wants),
    previous,
  };
}

/**
 * At the average gain across the readings so far, how many months until the score
 * reaches 100. Null when the score is flat or falling, because an invented date is
 * worse than no date at all.
 */
export function monthsToFreedom(history: ScoreSnapshot[], current: number): number | null {
  if (current >= 100) return 0;
  if (history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  const gained = last.score - first.score;
  const months = history.length - 1;
  if (gained <= 0 || months <= 0) return null;
  const perMonth = gained / months;
  const remaining = 100 - current;
  return Math.max(1, Math.ceil(remaining / perMonth));
}
