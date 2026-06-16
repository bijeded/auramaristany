import { describe, it, expect } from "vitest";
import {
  getCurrentDayKey,
  isDayAccessible,
  getAccessibleSeries,
  getCurrentSeriesNumber,
  toDayOfWeek,
} from "@/lib/content/access";

// Helper: build a UTC date string for a given offset from a reference start
function daysAfter(startIso: string, days: number): Date {
  const d = new Date(startIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const PERIOD_START = "2026-06-02T00:00:00Z"; // a Monday

describe("toDayOfWeek", () => {
  it("maps Sunday (0) to domingo", () => {
    const d = new Date("2026-06-07T12:00:00Z"); // Sunday
    expect(toDayOfWeek(d)).toBe("domingo");
  });

  it("maps Monday (1) to lunes", () => {
    const d = new Date("2026-06-08T12:00:00Z"); // Monday
    expect(toDayOfWeek(d)).toBe("lunes");
  });

  it("usa UTC: 2026-06-08T02:00:00Z (madrugada) sigue siendo lunes", () => {
    const d = new Date("2026-06-08T02:00:00Z"); // lunes en UTC
    expect(toDayOfWeek(d)).toBe("lunes");
  });

  it("usa UTC: instante con offset que cae en lunes UTC", () => {
    // 2026-06-07T20:00:00-06:00 === 2026-06-08T02:00:00Z (lunes UTC)
    const d = new Date("2026-06-07T20:00:00-06:00");
    expect(toDayOfWeek(d)).toBe("lunes");
  });
});

describe("getCurrentDayKey", () => {
  it("returns week 1 on the period start day", () => {
    const today = daysAfter(PERIOD_START, 0); // day 0 → week 1
    const key = getCurrentDayKey(PERIOD_START, today);
    expect(key.week_number).toBe(1);
  });

  it("returns week 1 on day 6", () => {
    const today = daysAfter(PERIOD_START, 6);
    const key = getCurrentDayKey(PERIOD_START, today);
    expect(key.week_number).toBe(1);
  });

  it("returns week 2 on day 7", () => {
    const today = daysAfter(PERIOD_START, 7);
    const key = getCurrentDayKey(PERIOD_START, today);
    expect(key.week_number).toBe(2);
  });

  it("returns week 4 on day 21", () => {
    const today = daysAfter(PERIOD_START, 21);
    const key = getCurrentDayKey(PERIOD_START, today);
    expect(key.week_number).toBe(4);
  });

  it("clamps to week 4 on day 28 (5th week territory)", () => {
    const today = daysAfter(PERIOD_START, 28);
    const key = getCurrentDayKey(PERIOD_START, today);
    expect(key.week_number).toBe(4);
  });

  it("clamps to week 4 on day 35", () => {
    const today = daysAfter(PERIOD_START, 35);
    const key = getCurrentDayKey(PERIOD_START, today);
    expect(key.week_number).toBe(4);
  });

  it("returns the correct day_of_week for today", () => {
    // PERIOD_START is Tuesday 2026-06-02 (UTC); day +2 = 2026-06-04 = Thursday
    // Uses getUTCDay() to align with Date.UTC week computation (EDGE-3).
    const today = daysAfter(PERIOD_START, 2);
    const key = getCurrentDayKey(PERIOD_START, today);
    expect(key.day_of_week).toBe("jueves");
  });

  it("never returns week_number < 1 when today is before period start", () => {
    const yesterday = daysAfter(PERIOD_START, -1);
    const key = getCurrentDayKey(PERIOD_START, yesterday);
    expect(key.week_number).toBeGreaterThanOrEqual(1);
  });
});

describe("isDayAccessible", () => {
  const current = { week_number: 2, day_of_week: "miercoles" as const };

  it("allows a day in a past week", () => {
    expect(isDayAccessible(1, "viernes", current)).toBe(true);
  });

  it("blocks a day in a future week", () => {
    expect(isDayAccessible(3, "lunes", current)).toBe(false);
  });

  it("allows the exact current (week, day)", () => {
    expect(isDayAccessible(2, "miercoles", current)).toBe(true);
  });

  it("allows an earlier day in the current week", () => {
    expect(isDayAccessible(2, "lunes", current)).toBe(true);
  });

  it("blocks a later day in the current week", () => {
    expect(isDayAccessible(2, "jueves", current)).toBe(false);
  });

  it("blocks domingo (7) when current day is sabado (6)", () => {
    const saturdayCurrent = { week_number: 1, day_of_week: "sabado" as const };
    expect(isDayAccessible(1, "domingo", saturdayCurrent)).toBe(false);
  });

  it("allows sabado when current day is domingo", () => {
    const sundayCurrent = { week_number: 1, day_of_week: "domingo" as const };
    expect(isDayAccessible(1, "sabado", sundayCurrent)).toBe(true);
  });
});

describe("getAccessibleSeries — CuarentaMás", () => {
  it("returns only the current series (month 1)", () => {
    const result = getAccessibleSeries("cuarenta-mas", 1);
    expect(result).toEqual([{ series_number: 1, fully_accessible: false }]);
  });

  it("returns only the current series (month 4)", () => {
    const result = getAccessibleSeries("cuarenta-mas", 4);
    expect(result).toEqual([{ series_number: 4, fully_accessible: false }]);
  });
});

describe("getAccessibleSeries — CuarentaMás Extra", () => {
  it("returns only series matching months_elapsed", () => {
    const result = getAccessibleSeries("cuarenta-mas-extra", 3);
    expect(result).toEqual([{ series_number: 3, fully_accessible: false }]);
  });
});

describe("getAccessibleSeries — Strong & Fit", () => {
  it("returns only series 1 on month 1 (not fully accessible)", () => {
    const result = getAccessibleSeries("strong-fit", 1);
    expect(result).toEqual([{ series_number: 1, fully_accessible: false }]);
  });

  it("returns series 1 (full) and series 2 (restricted) on month 2", () => {
    const result = getAccessibleSeries("strong-fit", 2);
    expect(result).toEqual([
      { series_number: 1, fully_accessible: true },
      { series_number: 2, fully_accessible: false },
    ]);
  });

  it("returns 3 series on month 3 — first two fully accessible", () => {
    const result = getAccessibleSeries("strong-fit", 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ series_number: 1, fully_accessible: true });
    expect(result[1]).toEqual({ series_number: 2, fully_accessible: true });
    expect(result[2]).toEqual({ series_number: 3, fully_accessible: false });
  });
});

describe("getCurrentSeriesNumber", () => {
  it("returns months_elapsed as the current series number", () => {
    expect(getCurrentSeriesNumber(1)).toBe(1);
    expect(getCurrentSeriesNumber(5)).toBe(5);
  });
});
