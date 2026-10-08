import { describe, expect, it } from "vitest";
import {
  expenseRunRate, freedomBand, freedomScore, monthlyExpenses, monthsToFreedom,
  needOf, passiveMonthly, scoreMovement, type ScoreSnapshot,
} from "@/lib/domain/freedom";
import type { ItemLike } from "@/lib/domain/rules";
import type { Kind } from "@/lib/domain/kinds";

const base = (over: Partial<ItemLike> & { kind: Kind }): ItemLike => ({
  id: Math.random().toString(36).slice(2),
  title: "x",
  who: null,
  dueDate: null,
  amount: null,
  status: null,
  stage: null,
  slot: null,
  slotWeek: null,
  section: null,
  linkedItemId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const bill = (amount: string, repeat: string, need?: string, status = "To pay") =>
  base({ kind: "bill", amount, repeat, need, status });

const passive = (amount: string, over: Partial<ItemLike> = {}) =>
  base({ kind: "income", amount, stream: "Passive", confidence: "Expected", ...over });

describe("needOf", () => {
  it("reads the stored classification", () => {
    expect(needOf(bill("100", "Monthly", "Want"))).toBe("Want");
    expect(needOf(bill("100", "Monthly", "Need"))).toBe("Need");
  });

  it("falls back to the kind's default for records saved before the field existed", () => {
    expect(needOf(bill("100", "Monthly"))).toBe("Need");
    expect(needOf(base({ kind: "onceoff" }))).toBe("Want");
    expect(needOf(base({ kind: "maintenance" }))).toBe("Need");
  });
});

describe("expenseRunRate", () => {
  it("takes a monthly bill at face value and spreads an annual one over twelve", () => {
    const rate = expenseRunRate([
      bill("1000", "Monthly", "Need"),
      bill("1200", "Annually", "Need"),
    ]);
    expect(rate.needs).toBe(110_000); // R1,000 + R100
    expect(rate.wants).toBe(0);
    expect(rate.total).toBe(110_000);
  });

  it("separates needs from wants", () => {
    const rate = expenseRunRate([
      bill("8000", "Monthly", "Need"),
      bill("2000", "Monthly", "Want"),
    ]);
    expect(rate.needs).toBe(800_000);
    expect(rate.wants).toBe(200_000);
    expect(rate.total).toBe(1_000_000);
  });

  it("ignores one-off bills, paid bills, archived bills and other kinds", () => {
    const rate = expenseRunRate([
      bill("500", "Once", "Need"),
      bill("500", "Monthly", "Need", "Paid"),
      { ...bill("500", "Monthly", "Need"), archivedAt: "2026-01-01T00:00:00.000Z" },
      base({ kind: "onceoff", amount: "500" }),
      base({ kind: "maintenance", amount: "500" }),
      base({ kind: "medical", amount: "500" }),
    ]);
    expect(rate.total).toBe(0);
    expect(rate.rows).toHaveLength(0);
  });
});

describe("monthlyExpenses", () => {
  const bills = [bill("8000", "Monthly", "Need"), bill("2000", "Monthly", "Want")];

  it("reads the bills when no baseline is set", () => {
    const expenses = monthlyExpenses(bills);
    expect(expenses.needs).toBe(800_000);
    expect(expenses.wants).toBe(200_000);
    expect(expenses.needsFromBaseline).toBe(false);
  });

  it("lets a typed-in figure win, one side at a time", () => {
    const expenses = monthlyExpenses(bills, { needs: 1_200_000, wants: null });
    expect(expenses.needs).toBe(1_200_000);
    expect(expenses.wants).toBe(200_000);
    expect(expenses.total).toBe(1_400_000);
    expect(expenses.needsFromBaseline).toBe(true);
    expect(expenses.wantsFromBaseline).toBe(false);
    // The run-rate is still carried, so the screen can show both numbers.
    expect(expenses.runRate.needs).toBe(800_000);
  });

  it("treats zero as a real figure, not an empty one", () => {
    expect(monthlyExpenses(bills, { needs: null, wants: 0 }).wants).toBe(0);
    expect(monthlyExpenses(bills, { needs: null, wants: 0 }).wantsFromBaseline).toBe(true);
  });
});

describe("passiveMonthly", () => {
  const now = "2026-06-01";

  it("counts only passive income, and never what is merely possible", () => {
    const result = passiveMonthly(
      [
        passive("2500", { dueDate: "2026-06-15" }),
        passive("9999", { dueDate: "2026-06-15", confidence: "Possible" }),
        base({ kind: "income", amount: "50000", stream: "Active", dueDate: "2026-06-15" }),
      ],
      now,
    );
    expect(result.monthly).toBe(250_000);
    expect(result.rows).toHaveLength(1);
  });

  it("leaves out income already received, archived, or beyond the window", () => {
    const result = passiveMonthly(
      [
        passive("1000", { dueDate: "2026-06-10", receivedDate: "2026-06-10" }),
        { ...passive("1000", { dueDate: "2026-06-10" }), archivedAt: "2026-01-01T00:00:00.000Z" },
        passive("1000", { dueDate: "2026-12-01" }),
      ],
      now,
    );
    expect(result.monthly).toBe(0);
  });

  it("includes a standing passive source with no date", () => {
    expect(passiveMonthly([passive("4000")], now).monthly).toBe(400_000);
  });
});

describe("freedomScore", () => {
  it("is the worked example: R2,500 against R10,000 is 25% of the way", () => {
    const score = freedomScore(250_000, monthlyExpenses([], { needs: 700_000, wants: 300_000 }));
    expect(score.score).toBe(25);
    expect(score.gap).toBe(750_000);
    expect(score.free).toBe(false);
  });

  it("scores needs separately, because that line comes first", () => {
    const score = freedomScore(700_000, monthlyExpenses([], { needs: 700_000, wants: 300_000 }));
    expect(score.score).toBe(70);
    expect(score.needsScore).toBe(100);
    expect(score.needsCovered).toBe(true);
    expect(score.needsGap).toBe(0);
    expect(score.free).toBe(false);
  });

  it("crosses 100% when passive income clears everything", () => {
    const score = freedomScore(1_200_000, monthlyExpenses([], { needs: 700_000, wants: 300_000 }));
    expect(score.score).toBe(120);
    expect(score.free).toBe(true);
    expect(score.gap).toBe(0);
  });

  it("never reads the first rand as zero per cent", () => {
    const score = freedomScore(100, monthlyExpenses([], { needs: 1_000_000, wants: 0 }));
    expect(score.score).toBe(1);
  });

  it("holds at zero with no passive income at all", () => {
    const score = freedomScore(0, monthlyExpenses([], { needs: 1_000_000, wants: 0 }));
    expect(score.score).toBe(0);
    expect(score.gap).toBe(1_000_000);
    expect(score.free).toBe(false);
  });

  it("does not divide by zero when nothing is spent", () => {
    expect(freedomScore(0, monthlyExpenses([])).score).toBe(0);
    expect(freedomScore(100_000, monthlyExpenses([])).score).toBe(100);
    expect(freedomScore(0, monthlyExpenses([])).free).toBe(false);
  });
});

describe("freedomBand", () => {
  it("names each stretch of the board", () => {
    expect(freedomBand(0).label).toBe("Not on the board yet");
    expect(freedomBand(1).label).toBe("On the board");
    expect(freedomBand(25).label).toBe("A quarter of the way");
    expect(freedomBand(50).label).toBe("Halfway there");
    expect(freedomBand(75).label).toBe("Within reach");
    expect(freedomBand(100).label).toBe("Financially free");
    expect(freedomBand(180).label).toBe("Financially free");
  });
});

describe("keeping score", () => {
  const snap = (periodStart: string, score: number, passiveCents = 0): ScoreSnapshot => ({
    periodStart,
    passive: passiveCents,
    needs: 700_000,
    wants: 300_000,
    score,
  });

  it("reports no movement until there are two readings", () => {
    expect(scoreMovement([]).previous).toBeNull();
    expect(scoreMovement([snap("2026-01-01", 20)]).points).toBe(0);
  });

  it("compares the last two readings", () => {
    const movement = scoreMovement([
      snap("2026-01-01", 20, 200_000),
      snap("2026-02-01", 26, 260_000),
    ]);
    expect(movement.points).toBe(6);
    expect(movement.passive).toBe(60_000);
    expect(movement.previous?.score).toBe(20);
  });

  it("reports a slip honestly", () => {
    expect(scoreMovement([snap("2026-01-01", 30), snap("2026-02-01", 24)]).points).toBe(-6);
  });

  it("projects months to freedom from the average gain", () => {
    // 20 → 30 over two months is 5 points a month; 70 points left is 14 months.
    const history = [snap("2026-01-01", 20), snap("2026-02-01", 25), snap("2026-03-01", 30)];
    expect(monthsToFreedom(history, 30)).toBe(14);
  });

  it("refuses to invent a date when the score is flat or falling", () => {
    expect(monthsToFreedom([snap("2026-01-01", 30), snap("2026-02-01", 30)], 30)).toBeNull();
    expect(monthsToFreedom([snap("2026-01-01", 30), snap("2026-02-01", 20)], 20)).toBeNull();
    expect(monthsToFreedom([snap("2026-01-01", 30)], 30)).toBeNull();
  });

  it("is already there at 100%", () => {
    expect(monthsToFreedom([], 100)).toBe(0);
    expect(monthsToFreedom([], 140)).toBe(0);
  });
});
