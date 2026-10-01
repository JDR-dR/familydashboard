import { describe, expect, it } from "vitest";
import {
  carriedOver, cashRequired, defaultDueDate, dueForRollover, dueThisWeek,
  incomeSplit, incomeWindow, medicalTotals, nextOccurrence, projectTotals,
  weeksCarried, type ItemLike,
} from "@/lib/domain/rules";
import { money, moneyShort, sumCents, toCents } from "@/lib/domain/money";
import { isDone, toneOf } from "@/lib/domain/kinds";

const NOW = "2026-10-05"; // a Monday, in the week that started Friday 2 October

function item(partial: Partial<ItemLike> & { id: string; kind: ItemLike["kind"] }): ItemLike {
  return {
    title: "Untitled", who: null, dueDate: null, amount: null, status: null,
    stage: null, slot: null, slotWeek: null, section: null, linkedItemId: null,
    createdAt: `${NOW}T08:00:00.000Z`, archivedAt: null, ...partial,
  };
}

describe("carry-forward", () => {
  const items = [
    item({ id: "old", kind: "task", status: "Needs Action", createdAt: "2026-09-11T08:00:00.000Z" }),
    item({ id: "overdue", kind: "task", status: "Waiting", dueDate: "2026-09-29" }),
    item({ id: "done-old", kind: "task", status: "Done", createdAt: "2026-09-11T08:00:00.000Z" }),
    item({ id: "this-week", kind: "task", status: "Needs Action", dueDate: "2026-10-08" }),
    item({ id: "archived", kind: "task", status: "Needs Action", dueDate: "2026-09-20", archivedAt: "2026-09-21T00:00:00.000Z" }),
  ];

  it("carries unfinished work from before this Friday", () => {
    expect(carriedOver(items, NOW).map((i) => i.id)).toEqual(["overdue", "old"]);
  });

  it("leaves finished, archived and current work alone", () => {
    const ids = carriedOver(items, NOW).map((i) => i.id);
    expect(ids).not.toContain("done-old");
    expect(ids).not.toContain("this-week");
    expect(ids).not.toContain("archived");
  });

  it("does not list a carried task twice in this week", () => {
    expect(dueThisWeek(items, NOW).map((i) => i.id)).toEqual(["this-week"]);
  });

  it("counts how long something has been carried", () => {
    expect(weeksCarried(items[0], NOW)).toBe(3);
    expect(weeksCarried(items[3], NOW)).toBe(0);
  });
});

describe("discuss-at slots", () => {
  it("dates new tasks by their slot", () => {
    expect(defaultDueDate("This week", NOW)).toBe("2026-10-08");
    expect(defaultDueDate("Next week", NOW)).toBe("2026-10-15");
    expect(defaultDueDate("Monthly drive", NOW)).toBeNull();
    expect(defaultDueDate("To decide together", NOW)).toBeNull();
  });

  it("rolls next week's tasks in once their week arrives", () => {
    const items = [
      item({ id: "ready", kind: "task", status: "Needs Action", slot: "Next week", slotWeek: "2026-09-25" }),
      item({ id: "still-waiting", kind: "task", status: "Needs Action", slot: "Next week", slotWeek: "2026-10-02" }),
      item({ id: "done", kind: "task", status: "Done", slot: "Next week", slotWeek: "2026-09-25" }),
    ];
    expect(dueForRollover(items, NOW).map((i) => i.id)).toEqual(["ready"]);
  });

  it("puts a This week task into this week even with no date", () => {
    const items = [item({ id: "slotted", kind: "task", status: "Needs Action", slot: "This week" })];
    expect(dueThisWeek(items, NOW).map((i) => i.id)).toEqual(["slotted"]);
  });
});

describe("cash required in the next 30 days", () => {
  const items = [
    item({ id: "bill", kind: "bill", status: "To pay", amount: 3850, dueDate: "2026-10-09" }),
    item({ id: "paid-bill", kind: "bill", status: "Paid", amount: 999, dueDate: "2026-10-09" }),
    item({ id: "considering", kind: "onceoff", status: "Considering", amount: 5000, dueDate: "2026-10-12" }),
    item({ id: "to-buy", kind: "onceoff", status: "To buy", amount: 1200, dueDate: "2026-10-12" }),
    item({ id: "maint", kind: "maintenance", status: "Needs Action", amount: 4500, dueDate: "2026-10-10" }),
    item({ id: "maint-fine", kind: "maintenance", status: "Fine", amount: 800, dueDate: "2026-10-10" }),
    item({ id: "quoted", kind: "projectexp", status: "Quoted", amount: 145000, dueDate: "2026-10-14" }),
    item({ id: "planned", kind: "projectexp", status: "Planned", amount: 20000, dueDate: "2026-10-14" }),
    item({ id: "med", kind: "medical", status: "To pay", amount: 9800, dueDate: "2026-10-07" }),
    item({ id: "med-claim", kind: "medical", status: "Claim submitted", amount: 4200, dueDate: "2026-10-07" }),
    item({ id: "sow", kind: "sowing", status: "Committed", amount: 15000, dueDate: "2026-10-30" }),
    item({ id: "sow-considering", kind: "sowing", status: "Considering", amount: 1000, dueDate: "2026-10-30" }),
    item({ id: "booked", kind: "experience", stage: "Booked", amount: 3500, dueDate: "2026-10-20" }),
    item({ id: "dreaming", kind: "experience", stage: "Dreaming", amount: 40000, dueDate: "2026-10-20" }),
    item({ id: "task", kind: "task", status: "Needs Action", amount: 450, dueDate: "2026-10-16" }),
    item({ id: "linked-task", kind: "task", status: "Needs Action", amount: 4500, dueDate: "2026-10-16", linkedItemId: "maint" }),
    item({ id: "far-off", kind: "bill", status: "To pay", amount: 99999, dueDate: "2026-12-01" }),
  ];

  const out = cashRequired(items, NOW);

  it("includes only what the rules say", () => {
    expect(out.rows.map((i) => i.id).sort()).toEqual(
      ["bill", "booked", "maint", "med", "quoted", "sow", "task", "to-buy"].sort(),
    );
  });

  it("never double counts a task created from another item", () => {
    expect(out.rows.map((i) => i.id)).not.toContain("linked-task");
  });

  it("totals by bucket and overall", () => {
    expect(out.parts.Bills).toBe(toCents(3850));
    expect(out.parts.Projects).toBe(toCents(145000));
    expect(out.parts.Medical).toBe(toCents(9800));
    expect(out.total).toBe(toCents(3850 + 1200 + 4500 + 145000 + 9800 + 15000 + 3500 + 450));
  });
});

describe("income", () => {
  const items = [
    item({ id: "salary", kind: "income", amount: 85000, dueDate: "2026-10-25", confidence: "Confirmed", stream: "Active" }),
    item({ id: "rent", kind: "income", amount: 12500, dueDate: "2026-10-10", confidence: "Confirmed", stream: "Passive" }),
    item({ id: "dividend", kind: "income", amount: 150000, dueDate: "2026-10-24", confidence: "Possible", stream: "Passive" }),
    item({ id: "received", kind: "income", amount: 30500, actual: 30500, receivedDate: "2026-09-28", dueDate: "2026-09-28", stream: "Active" }),
    item({ id: "far-off", kind: "income", amount: 60000, dueDate: "2027-01-05", confidence: "Expected", stream: "Active" }),
  ];

  const window = incomeWindow(items, NOW);

  it("counts confirmed and expected, never possible", () => {
    expect(window.total).toBe(toCents(97500));
    expect(window.possibleTotal).toBe(toCents(150000));
  });

  it("leaves received income out of the forward view", () => {
    expect(window.rows.map((i) => i.id)).not.toContain("received");
  });

  it("splits active from passive", () => {
    const split = incomeSplit(window.firm);
    expect(split.active).toBe(toCents(85000));
    expect(split.passive).toBe(toCents(12500));
    expect(split.total).toBe(toCents(97500));
  });

  it("treats an actual amount or a received date as done", () => {
    expect(isDone(items[3])).toBe(true);
    expect(isDone(items[0])).toBe(false);
  });
});

describe("projects and medical", () => {
  it("totals a project against its budget", () => {
    const project = item({ id: "kitchen", kind: "project", amount: 380000, status: "In progress" });
    const costs = [
      item({ id: "cab", kind: "projectexp", amount: 145000, status: "Quoted", projectId: "kitchen" }),
      item({ id: "dep", kind: "projectexp", amount: 60000, status: "Paid", projectId: "kitchen" }),
      item({ id: "other", kind: "projectexp", amount: 10000, status: "Paid", projectId: "bathroom" }),
    ];
    const totals = projectTotals(project, costs);
    expect(totals.committed).toBe(toCents(205000));
    expect(totals.paid).toBe(toCents(60000));
    expect(totals.overBudget).toBe(false);
    expect(totals.percentUsed).toBe(54);
  });

  it("flags a project over its budget", () => {
    const project = item({ id: "p", kind: "project", amount: 1000 });
    const costs = [item({ id: "c", kind: "projectexp", amount: 1500, projectId: "p" })];
    expect(projectTotals(project, costs).overBudget).toBe(true);
  });

  it("works out medical out-of-pocket", () => {
    const items = [
      item({ id: "mri", kind: "medical", amount: 9800, status: "To pay", dueDate: "2026-10-07" }),
      item({ id: "dent", kind: "medical", amount: 4200, status: "Claim submitted", reimbursed: 3000, dueDate: "2026-09-11" }),
    ];
    const totals = medicalTotals(items, NOW);
    expect(totals.outstanding).toBe(toCents(9800));
    expect(totals.paidThisYear).toBe(toCents(4200));
    expect(totals.reimbursedThisYear).toBe(toCents(3000));
    expect(totals.outOfPocket).toBe(toCents(1200));
  });
});

describe("repeating bills", () => {
  it("dates the next occurrence", () => {
    expect(nextOccurrence({ dueDate: "2026-10-09", repeat: "Monthly" })).toBe("2026-11-09");
    expect(nextOccurrence({ dueDate: "2026-01-31", repeat: "Monthly" })).toBe("2026-02-28");
    expect(nextOccurrence({ dueDate: "2026-10-09", repeat: "Annually" })).toBe("2027-10-09");
  });

  it("does not repeat a once-off", () => {
    expect(nextOccurrence({ dueDate: "2026-10-09", repeat: "Once" })).toBeNull();
    expect(nextOccurrence({ dueDate: null, repeat: "Monthly" })).toBeNull();
  });
});

describe("money", () => {
  it("never loses cents to floating point", () => {
    expect(sumCents([0.1, 0.2])).toBe(30);
    expect(sumCents(["1234.56", 1000, null, ""])).toBe(223456);
  });

  it("formats rand without decimals", () => {
    expect(money(toCents(159500))).toBe("R159,500");
    expect(money(toCents(-4500))).toBe("−R4,500");
    expect(moneyShort(toCents(160000))).toBe("R160k");
    expect(moneyShort(toCents(9_000_000))).toBe("R9m");
    expect(moneyShort(toCents(950))).toBe("R950");
  });
});

describe("tone", () => {
  it("is orange only when someone must act", () => {
    expect(toneOf(item({ id: "a", kind: "task", status: "Needs Action" }))).toBe("action");
    expect(toneOf(item({ id: "b", kind: "task", status: "Waiting" }))).toBe("waiting");
    expect(toneOf(item({ id: "c", kind: "task", status: "Done" }))).toBe("done");
    expect(toneOf(item({ id: "d", kind: "investment", stage: "Due Diligence" }))).toBe("waiting");
    expect(toneOf(item({ id: "e", kind: "investment", stage: "Invested" }))).toBe("done");
  });
});
