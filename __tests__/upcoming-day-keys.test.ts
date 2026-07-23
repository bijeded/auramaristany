import { describe, it, expect } from "vitest";
import { getUpcomingDayKeys } from "@/lib/content/access";

// Helper: build a UTC date for a given offset from a reference start
function daysAfter(startIso: string, days: number): Date {
  const d = new Date(startIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const PERIOD_START = "2026-06-02T00:00:00Z"; // a Tuesday (martes)
const PERIOD_END = "2026-07-02T00:00:00Z"; // 30-day period

describe("getUpcomingDayKeys", () => {
  it("returns 8 entries (today + 7) mid-period", () => {
    // Arrange
    const today = daysAfter(PERIOD_START, 10);
    // Act
    const keys = getUpcomingDayKeys(PERIOD_START, PERIOD_END, today);
    // Assert
    expect(keys).toHaveLength(8);
  });

  it("marks only the first entry as today", () => {
    const today = daysAfter(PERIOD_START, 10);
    const keys = getUpcomingDayKeys(PERIOD_START, PERIOD_END, today);
    expect(keys[0].isToday).toBe(true);
    expect(keys.slice(1).every((k) => !k.isToday)).toBe(true);
  });

  it("computes consecutive UTC dates and day_of_week", () => {
    const today = daysAfter(PERIOD_START, 0); // martes 2026-06-02
    const keys = getUpcomingDayKeys(PERIOD_START, PERIOD_END, today);
    expect(keys[0]).toMatchObject({
      date: "2026-06-02",
      day_of_week: "martes",
      week_number: 1,
    });
    expect(keys[1]).toMatchObject({
      date: "2026-06-03",
      day_of_week: "miercoles",
    });
    expect(keys[7]).toMatchObject({ date: "2026-06-09", day_of_week: "martes" });
  });

  it("crosses week boundaries correctly", () => {
    // day 5 (dom) … day 12: week 1 → week 2 at day 7
    const today = daysAfter(PERIOD_START, 5);
    const keys = getUpcomingDayKeys(PERIOD_START, PERIOD_END, today);
    expect(keys[0].week_number).toBe(1); // day 5
    expect(keys[1].week_number).toBe(1); // day 6
    expect(keys[2].week_number).toBe(2); // day 7
  });

  it("cuts the window at current_period_end (shrinking list)", () => {
    // period ends at day 30; today = day 27 → days 27, 28, 29 remain (3 rows)
    const today = daysAfter(PERIOD_START, 27);
    const keys = getUpcomingDayKeys(PERIOD_START, PERIOD_END, today);
    expect(keys).toHaveLength(3);
    expect(keys[keys.length - 1].date).toBe("2026-07-01");
  });

  it("clamps days 29-31 of a long period to week 4", () => {
    // day 28 would be week 5 → clamped to 4 (still inside period)
    const today = daysAfter(PERIOD_START, 26);
    const keys = getUpcomingDayKeys(PERIOD_START, PERIOD_END, today);
    // days 26..29 within the period: day 28+ clamps to week 4
    expect(keys.every((k) => k.week_number <= 4)).toBe(true);
    expect(keys[2].week_number).toBe(4); // day 28
    expect(keys[3].week_number).toBe(4); // day 29
  });

  it("applies no cut when current_period_end is null", () => {
    const today = daysAfter(PERIOD_START, 27);
    const keys = getUpcomingDayKeys(PERIOD_START, null, today);
    expect(keys).toHaveLength(8);
  });

  it("returns an empty list when today is on/after period end", () => {
    const today = daysAfter(PERIOD_START, 30);
    const keys = getUpcomingDayKeys(PERIOD_START, PERIOD_END, today);
    expect(keys).toHaveLength(0);
  });
});
