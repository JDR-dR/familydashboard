/**
 * The money screens, in the order the budget itself runs: what comes in, what is
 * put away, then what is spent. One place decides which records belong to which
 * screen, so the screens and the overview can never disagree about what counts
 * as a need.
 */

import {
  EFUND_CATEGORIES, INCOME_CATEGORIES, INVEST_CATEGORIES, MEDICAL_CATEGORIES,
  NEEDS_CATEGORIES, WANTS_CATEGORIES, isDone, type Kind,
} from "./kinds";
import { needOf } from "./freedom";
import { sumCents, toCents, type Cents } from "./money";
import type { ItemLike } from "./rules";

export const FINANCE_SECTIONS = [
  { key: "income", title: "Income", kind: "income",
    blurb: "What comes in, before anything goes out." },
  { key: "investments", title: "Investments", kind: "saving",
    blurb: "Target 10–20% of income. Paid before the month spends it." },
  { key: "efund", title: "Emergency fund", kind: "saving",
    blurb: "Three months of needs is the line worth holding." },
  { key: "needs", title: "Needs", kind: "bill",
    blurb: "The essentials. This is the line passive income has to clear." },
  { key: "wants", title: "Wants", kind: "bill",
    blurb: "What you choose on top. The side you can change this week." },
  { key: "medical", title: "Medical", kind: "medical",
    blurb: "Bills, claims and what came back from the medical aid." },
] as const;

export type FinanceKey = (typeof FINANCE_SECTIONS)[number]["key"];
export const FINANCE_KEYS = FINANCE_SECTIONS.map((s) => s.key) as readonly FinanceKey[];

export const financeSection = (key: FinanceKey) =>
  FINANCE_SECTIONS.find((s) => s.key === key)!;

/** The records a finance screen owns. */
export function financeRows(key: FinanceKey, items: ItemLike[]): ItemLike[] {
  const live = items.filter((i) => !i.archivedAt);
  if (key === "income") return live.filter((i) => i.kind === "income");
  if (key === "investments")
    return live.filter((i) => i.kind === "saving" && (i.bucket ?? "Investments") === "Investments");
  if (key === "efund")
    return live.filter((i) => i.kind === "saving" && i.bucket === "Emergency fund");
  if (key === "medical") return live.filter((i) => i.kind === "medical");
  const want = key === "wants";
  return live.filter(
    (i) =>
      (i.kind === "bill" || i.kind === "onceoff" || i.kind === "maintenance") &&
      needOf(i) === (want ? "Want" : "Need"),
  );
}

export function financeCategories(key: FinanceKey): readonly string[] {
  if (key === "income") return INCOME_CATEGORIES;
  if (key === "investments") return INVEST_CATEGORIES;
  if (key === "efund") return EFUND_CATEGORIES;
  if (key === "medical") return MEDICAL_CATEGORIES;
  return key === "wants" ? WANTS_CATEGORIES : NEEDS_CATEGORIES;
}

/** The defaults a new record gets when added from a given screen. */
export function financeDefaults(key: FinanceKey): Record<string, string> {
  if (key === "investments") return { bucket: "Investments" };
  if (key === "efund") return { bucket: "Emergency fund" };
  if (key === "needs") return { need: "Need" };
  if (key === "wants") return { need: "Want" };
  return {};
}

/**
 * The monthly run-rate: a monthly line at face value, an annual one over twelve.
 * Anything that has already been settled, and anything that does not repeat, is
 * not a run-rate.
 */
export function runRate(rows: ItemLike[]): Cents {
  return rows.reduce((total, item) => {
    if (isDone(item as Parameters<typeof isDone>[0])) return total;
    const cents = toCents(item.amount);
    if (!cents) return total;
    if (item.repeat === "Monthly") return total + cents;
    if (item.repeat === "Annually") return total + Math.round(cents / 12);
    return total;
  }, 0);
}

export interface MonthlyBudget {
  income: Cents;
  investments: Cents;
  efund: Cents;
  needs: Cents;
  wants: Cents;
  medical: Cents;
  /** Everything the month has already promised. */
  committed: Cents;
  /** What is left once the month has been promised — the budget's own headline. */
  leftOver: Cents;
}

/**
 * The budget's summary line. Capex sits outside it on purpose: a quote for a
 * kitchen is not a monthly commitment, and folding it in makes every month look
 * like a disaster.
 */
export function monthlyBudget(items: ItemLike[]): MonthlyBudget {
  const of = (key: FinanceKey) => runRate(financeRows(key, items));
  const income = of("income");
  const investments = of("investments");
  const efund = of("efund");
  const needs = of("needs");
  const wants = of("wants");
  const medical = of("medical");
  const committed = investments + efund + needs + wants + medical;
  return { income, investments, efund, needs, wants, medical, committed, leftOver: income - committed };
}

/** Capex committed but not yet paid, which lives outside the monthly budget. */
export function capexOutstanding(items: ItemLike[]): Cents {
  return sumCents(
    items
      .filter((i) => i.kind === "projectexp" && !i.archivedAt && !isDone(i as Parameters<typeof isDone>[0]))
      .map((i) => i.amount),
  );
}

export const EXPENSE_SCREEN_KINDS: readonly Kind[] = ["bill", "onceoff", "maintenance"];
