import { describe, expect, it } from "vitest";
import {
  addDays, addMonths, formatDate, formatQuarter, formatWeekRange, monthEnd,
  monthStart, nextWeekEnd, quarterEnd, quarterKey, quarterOf, quarterStart,
  weekday, weekEnd, weeksBetween, weekStart, yearEnd, yearStart,
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

describe("quarters and years", () => {
  it("places every month in its calendar quarter", () => {
    expect(quarterOf("2026-01-15")).toBe(1);
    expect(quarterOf("2026-03-31")).toBe(1);
    expect(quarterOf("2026-04-01")).toBe(2);
    expect(quarterOf("2026-07-01")).toBe(3);
    expect(quarterOf("2026-10-08")).toBe(4);
    expect(quarterOf("2026-12-31")).toBe(4);
  });

  it("gives the first and last day of the quarter", () => {
    expect(quarterStart("2026-10-08")).toBe("2026-10-01");
    expect(quarterEnd("2026-10-08")).toBe("2026-12-31");
    expect(quarterStart("2026-02-14")).toBe("2026-01-01");
    expect(quarterEnd("2026-02-14")).toBe("2026-03-31");
    expect(quarterEnd("2026-05-02")).toBe("2026-06-30");
    expect(quarterEnd("2026-08-20")).toBe("2026-09-30");
  });

  it("keys and names a quarter", () => {
    expect(quarterKey("2026-10-08")).toBe("2026-Q4");
    expect(formatQuarter("2026-10-08")).toBe("Q4 2026 · October to December");
    expect(formatQuarter("2026-01-01")).toBe("Q1 2026 · January to March");
  });

  it("gives the first and last day of the year, leap year included", () => {
    expect(yearStart("2026-10-08")).toBe("2026-01-01");
    expect(yearEnd("2026-10-08")).toBe("2026-12-31");
    expect(yearEnd("2028-02-29")).toBe("2028-12-31");
  });
});
