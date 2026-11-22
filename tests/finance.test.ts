import { describe, expect, it } from "vitest";
import {
  capexOutstanding, financeCategories, financeDefaults, financeRows, monthlyBudget, runRate,
} from "@/lib/domain/finance";
import { catsOf, HORIZONS } from "@/lib/domain/kinds";
import type { ItemLike } from "@/lib/domain/rules";
import type { Kind } from "@/lib/domain/kinds";

const base = (over: Partial<ItemLike> & { kind: Kind }): ItemLike => ({
  id: Math.random().toString(36).slice(2),
  title: "x", who: null, dueDate: null, amount: null, status: null, stage: null,
  slot: null, slotWeek: null, section: null, linkedItemId: null,
  createdAt: "2026-01-01T00:00:00.000Z", ...over,
});

/* The real budget, so the totals can be reconciled against the spreadsheet. */
const NEEDS: Array<[string, number]> = [
  ["Home mortgage", 32500], ["Rates, taxes, electricity & water", 7000], ["Food", 15000],
  ["Vehicles", 8000], ["Bank charges", 950], ["Medical aid", 7500], ["Gap cover", 650],
  ["Life & buy-sell policy", 2239], ["Insurance — personal", 1700],
];
const WANTS: Array<[string, number]> = [
  ["Clothing", 1000], ["Home & garden", 750], ["Pets & food", 650],
  ["Wellness & personal care", 2000], ["Sport & subscriptions", 500], ["Gear repairs", 1000],
  ["Gifts", 1000], ["Homeware", 1000], ["Entertainment", 2000], ["Printing & stationery", 850],
  ["Travel — national", 1000], ["Travel — international", 1000], ["Tithing", 0],
];

const budget: ItemLike[] = [
  base({ kind: "income", category: "DI — Salary (John)", amount: 43000, repeat: "Monthly" }),
  base({ kind: "income", category: "DI — Salary (Moniek)", amount: 30500, repeat: "Monthly" }),
  base({ kind: "income", category: "DI — Dividends (medical)", amount: 8000, repeat: "Monthly", stream: "Passive" }),
  base({ kind: "income", category: "DI — Trust transfer", amount: 30000, repeat: "Monthly", stream: "Passive" }),
  base({ kind: "saving", bucket: "Investments", category: "TFSA — John", amount: 3800, repeat: "Monthly", status: "Scheduled" }),
  base({ kind: "saving", bucket: "Investments", category: "TFSA — Moniek", amount: 3800, repeat: "Monthly", status: "Scheduled" }),
  base({ kind: "saving", bucket: "Emergency fund", category: "Emergency fund", amount: 4000, repeat: "Monthly", status: "Scheduled" }),
  ...NEEDS.map(([c, a]) => base({ kind: "bill", category: c, amount: a, repeat: "Monthly", status: "To pay", need: "Need" })),
  ...WANTS.map(([c, a]) => base({ kind: "bill", category: c, amount: a, repeat: "Monthly", status: "To pay", need: "Want" })),
  base({ kind: "medical", category: "Medical — expenses", amount: 2500, repeat: "Monthly", status: "To pay" }),
  base({ kind: "medical", category: "Medical — doctors", amount: 2500, repeat: "Monthly", status: "To pay" }),
  base({ kind: "medical", category: "Medical — dental & provision", amount: 3000, repeat: "Monthly", status: "To pay" }),
];

describe("the totals reconcile to the budget", () => {
  const b = monthlyBudget(budget);
  it("income is R111,500", () => expect(b.income).toBe(11_150_000));
  it("investments are R7,600", () => expect(b.investments).toBe(760_000));
  it("the emergency fund is R4,000", () => expect(b.efund).toBe(400_000));
  it("needs are R75,539", () => expect(b.needs).toBe(7_553_900));
  it("wants are R12,750 once medical has its own screen", () => expect(b.wants).toBe(1_275_000));
  it("medical is R8,000", () => expect(b.medical).toBe(800_000));
  it("committed is R107,889, leaving R3,611 — the budget's own summary line", () => {
    expect(b.committed).toBe(10_788_900);
    // Cell B13 of the spreadsheet: "Left over / short", R3,611.
    expect(b.leftOver).toBe(361_100);
  });
  it("wants plus medical is the budget's own R20,750", () => {
    expect(b.wants + b.medical).toBe(2_075_000);
  });
});

describe("the run-rate", () => {
  it("takes a monthly line at face value and an annual one over twelve", () => {
    expect(runRate([
      base({ kind: "bill", amount: 1000, repeat: "Monthly", status: "To pay" }),
      base({ kind: "bill", amount: 1200, repeat: "Annually", status: "To pay" }),
    ])).toBe(110_000);
  });

  it("ignores a one-off, a settled line and a line with no amount", () => {
    expect(runRate([
      base({ kind: "bill", amount: 500, repeat: "Once", status: "To pay" }),
      base({ kind: "bill", amount: 500, repeat: "Monthly", status: "Paid" }),
      base({ kind: "bill", amount: null, repeat: "Monthly", status: "To pay" }),
    ])).toBe(0);
  });
});

describe("which screen owns what", () => {
  it("splits saving by its bucket, defaulting to investments", () => {
    const rows = [
      base({ kind: "saving", bucket: "Investments", amount: 100 }),
      base({ kind: "saving", bucket: "Emergency fund", amount: 200 }),
      base({ kind: "saving", amount: 300 }),
    ];
    expect(financeRows("investments", rows)).toHaveLength(2);
    expect(financeRows("efund", rows)).toHaveLength(1);
  });

  it("splits expenses by need or want across all three expense kinds", () => {
    const rows = [
      base({ kind: "bill", need: "Need", amount: 1 }),
      base({ kind: "onceoff", need: "Want", amount: 1 }),
      base({ kind: "maintenance", amount: 1 }),
    ];
    // Maintenance defaults to a need.
    expect(financeRows("needs", rows)).toHaveLength(2);
    expect(financeRows("wants", rows)).toHaveLength(1);
  });

  it("leaves archived records out of every screen", () => {
    const rows = [base({ kind: "income", amount: 1, archivedAt: "2026-01-01T00:00:00.000Z" })];
    expect(financeRows("income", rows)).toHaveLength(0);
  });

  it("gives a new record the defaults of the screen it was added from", () => {
    expect(financeDefaults("wants")).toEqual({ need: "Want" });
    expect(financeDefaults("efund")).toEqual({ bucket: "Emergency fund" });
    expect(financeDefaults("income")).toEqual({});
  });

  it("every screen offers somewhere for an off-budget item to land", () => {
    for (const key of ["needs", "wants", "medical", "income"] as const) {
      expect(financeCategories(key).some((c) => /other/i.test(c))).toBe(true);
    }
  });
});

describe("categories that follow the item", () => {
  it("a budget line's options depend on need or want", () => {
    expect(catsOf("bill", { need: "Want" })).toContain("Clothing");
    expect(catsOf("bill", { need: "Need" })).toContain("Home mortgage");
    expect(catsOf("bill", { need: "Need" })).not.toContain("Clothing");
  });

  it("a saving's options depend on its bucket", () => {
    expect(catsOf("saving", { bucket: "Emergency fund" })).toEqual(["Emergency fund"]);
    expect(catsOf("saving", { bucket: "Investments" })).toHaveLength(3);
    expect(catsOf("saving")).toHaveLength(3);
  });
});

describe("capex sits outside the monthly budget", () => {
  it("counts what is committed and not yet paid", () => {
    expect(capexOutstanding([
      base({ kind: "projectexp", amount: 145000, status: "Quoted" }),
      base({ kind: "projectexp", amount: 60000, status: "Paid" }),
      base({ kind: "projectexp", amount: 10000, status: "Planned", archivedAt: "2026-01-01T00:00:00.000Z" }),
    ])).toBe(14_500_000);
  });

  it("never reaches the monthly committed figure", () => {
    const withCapex = [...budget, base({ kind: "projectexp", amount: 145000, status: "Quoted" })];
    expect(monthlyBudget(withCapex).committed).toBe(monthlyBudget(budget).committed);
  });
});

describe("horizons", () => {
  it("are one, three and five years", () => {
    expect([...HORIZONS]).toEqual(["1 year", "3 years", "5 years"]);
  });
});
