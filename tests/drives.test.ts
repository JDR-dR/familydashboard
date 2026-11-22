import { describe, expect, it } from "vitest";
import {
  driveIds, driveLabel, driveOff, driveOrder, howManyDiscussed, moveStep,
  remapDiscussed, stepPos,
} from "@/lib/domain/drives";

describe("the shape of a drive", () => {
  it("offers every step until the household says otherwise", () => {
    expect(driveOrder("week")).toHaveLength(8);
    expect(driveOrder("month")).toHaveLength(5);
    expect(driveOrder("quarter")).toHaveLength(5);
    expect(driveOrder("year")).toHaveLength(6);
    expect(driveOff("week")).toEqual([]);
  });

  it("names its steps", () => {
    expect(driveLabel("week", "kingdom")).toBe("Kingdom");
    expect(driveLabel("week", "nonsense")).toBe("nonsense");
  });

  it("reads back a saved order and ignores a step that no longer exists", () => {
    expect(driveOrder("week", { week: ["kingdom", "ghost", "deals"] })).toEqual(["kingdom", "deals"]);
  });

  it("falls back to all of them when the saved order is empty", () => {
    expect(driveOrder("week", { week: [] })).toHaveLength(8);
    expect(driveOrder("week", {})).toHaveLength(8);
    expect(driveOrder("week", null)).toHaveLength(8);
  });
});

describe("moving a step", () => {
  it("swaps with the one above or below", () => {
    expect(moveStep("week", "thisweek", "up")).toEqual([
      "thisweek", "lastweek", "income", "home", "kingdom", "deals", "experiences", "decisions",
    ]);
    expect((moveStep("week", "lastweek", "down") as string[]).slice(0, 2)).toEqual(["thisweek", "lastweek"]);
  });

  it("refuses to move the first one up or the last one down", () => {
    expect(moveStep("week", "lastweek", "up")).toBeNull();
    expect(moveStep("week", "decisions", "down")).toBeNull();
  });

  it("takes a step out and leaves the rest in order", () => {
    expect(moveStep("week", "income", "remove")).toEqual([
      "lastweek", "thisweek", "home", "kingdom", "deals", "experiences", "decisions",
    ]);
  });

  it("will not empty the drive", () => {
    expect(moveStep("week", "kingdom", "remove", { week: ["kingdom"] })).toBe("last");
  });

  it("puts a step back beside its neighbour without disturbing the rest", () => {
    // Kingdom has been moved to the front and Experiences taken out.
    const saved = { week: ["kingdom", "lastweek", "thisweek", "income", "home", "deals", "decisions"] };
    expect(moveStep("week", "experiences", "add", saved)).toEqual([
      "kingdom", "lastweek", "thisweek", "income", "home", "deals", "experiences", "decisions",
    ]);
  });

  it("puts one with no earlier neighbour at the front", () => {
    expect(moveStep("week", "lastweek", "add", { week: ["decisions", "kingdom"] }))
      .toEqual(["lastweek", "decisions", "kingdom"]);
  });

  it("ignores adding something already there, or something that does not exist", () => {
    expect(moveStep("week", "kingdom", "add")).toBeNull();
    expect(moveStep("week", "ghost", "add", { week: ["kingdom"] })).toBeNull();
  });
});

describe("positions and counts", () => {
  it("numbers a step by where it sits now", () => {
    expect(stepPos("week", "lastweek")).toBe(1);
    expect(stepPos("week", "kingdom", { week: ["kingdom", "lastweek"] })).toBe(1);
    expect(stepPos("week", "income", { week: ["kingdom", "lastweek"] })).toBe(0);
  });

  it("counts only the steps actually in the drive", () => {
    expect(howManyDiscussed("week", { lastweek: true, income: true })).toEqual({ done: 2, total: 8 });
    // A tick on a step that has been taken out does not count toward the total.
    expect(howManyDiscussed("week", { lastweek: true, income: true }, { week: ["lastweek", "kingdom"] }))
      .toEqual({ done: 1, total: 2 });
  });
});

describe("ticks made before the steps had ids", () => {
  it("carries a numbered tick onto the step it was sitting on", () => {
    expect(remapDiscussed("week", { "1": true, "3": true, "8": true }))
      .toEqual({ lastweek: true, income: true, decisions: true });
  });

  it("uses each cadence's own list", () => {
    expect(remapDiscussed("quarter", { "2": true })).toEqual({ freedom: true });
    expect(remapDiscussed("year", { "2": true })).toEqual({ freedom: true });
  });

  it("leaves ids alone and reports nothing to do", () => {
    expect(remapDiscussed("week", { kingdom: true })).toBeNull();
    expect(remapDiscussed("week", {})).toBeNull();
    expect(remapDiscussed("week", null)).toBeNull();
  });

  it("drops a number that never had a step", () => {
    expect(remapDiscussed("month", { "1": true, "9": true })).toEqual({ parked: true });
  });

  it("every cadence's ids are unique", () => {
    for (const p of ["week", "month", "quarter", "year"] as const) {
      const ids = driveIds(p);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
