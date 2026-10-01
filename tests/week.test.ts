import { describe, expect, it } from "vitest";
import {
  addDays, addMonths, formatDate, formatWeekRange, monthEnd, monthStart,
  nextWeekEnd, weekday, weekEnd, weeksBetween, weekStart,
} from "@/lib/domain/week";

// 2026-10-01 is a Thursday, 2026-10-02 a Friday.
describe("the week runs Friday to Thursday", () => {
  it("knows its weekdays", () => {
    expect(weekday("2026-10-01")).toBe(4); // Thursday
    expect(weekday("2026-10-02")).toBe(5); // Friday
    expect(weekday("2026-10-04")).toBe(0); // Sunday
  });

  it("starts the week on the Friday that has already passed", () => {
    expect(weekStart("2026-10-01")).toBe("2026-09-25"); // Thursday looks back
    expect(weekStart("2026-10-02")).toBe("2026-10-02"); // Friday is its own start
    expect(weekStart("2026-10-03")).toBe("2026-10-02"); // Saturday
    expect(weekStart("2026-10-07")).toBe("2026-10-02"); // Wednesday
    expect(weekStart("2026-10-08")).toBe("2026-10-02"); // the following Thursday
    expect(weekStart("2026-10-09")).toBe("2026-10-09"); // next Friday rolls over
  });

  it("ends the week on Thursday", () => {
    expect(weekEnd("2026-10-02")).toBe("2026-10-08");
    expect(weekEnd("2026-10-01")).toBe("2026-10-01");
    expect(nextWeekEnd("2026-10-02")).toBe("2026-10-15");
  });

  it("counts whole weeks between dates by their Fridays", () => {
    expect(weeksBetween("2026-10-02", "2026-10-02")).toBe(0);
    expect(weeksBetween("2026-10-02", "2026-10-08")).toBe(0); // same week
    expect(weeksBetween("2026-10-02", "2026-10-09")).toBe(1);
    expect(weeksBetween("2026-09-11", "2026-10-02")).toBe(3);
    expect(weeksBetween("2026-10-09", "2026-10-02")).toBe(0); // never negative
  });

  it("formats the drive header", () => {
    expect(formatWeekRange("2026-10-05")).toBe("Friday 2 Oct to Thursday 8 Oct");
  });
});

describe("date helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("adds months, clamping to the shorter month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-10-15", 1)).toBe("2026-11-15");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-02-15", 12)).toBe("2027-02-15");
  });

  it("finds month boundaries", () => {
    expect(monthStart("2026-10-17")).toBe("2026-10-01");
    expect(monthEnd("2026-10-17")).toBe("2026-10-31");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29"); // leap year
  });

  it("shows the year only when it is not the current one", () => {
    expect(formatDate("2026-10-02", "2026-10-01")).toBe("2 Oct");
    expect(formatDate("2027-01-05", "2026-10-01")).toBe("5 Jan 27");
    expect(formatDate(null)).toBe("");
  });
});
