import { describe, it, expect } from "vitest";
import { planHistory, type SeedDay } from "../scripts/history-seed";
import { getCurrentDayKey, type DayOfWeek } from "../lib/content/access";

const DOWS: DayOfWeek[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

const ex = (id: string, overrides: Partial<SeedDay["exercises"][number]> = {}) => ({
  id,
  sets: 3,
  reps: "10-12",
  metrics: ["reps_done", "weight_kg"],
  ...overrides,
});

/** Un Mes 1 completo, 4x7, con dos ejercicios por día (el domingo también). */
function fullGrid(): SeedDay[] {
  const days: SeedDay[] = [];
  for (let w = 1; w <= 4; w++) {
    for (const dow of DOWS) {
      days.push({ id: `d-${w}-${dow}`, week_number: w, day_of_week: dow, exercises: [ex(`e-${dow}-a`), ex(`e-${dow}-b`)] });
    }
  }
  return days;
}

const day = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

describe("planHistory", () => {
  const today = new Date("2026-09-22T00:00:00Z");
  const periodStart = addDays(today, -25);

  it("logs only dates from the period start up to, not including, today", () => {
    // Arrange
    const days = fullGrid();
    // Act
    const rows = planHistory({ periodStart, today, days });
    // Assert
    for (const r of rows) {
      expect(r.log_date >= day(periodStart)).toBe(true);
      expect(r.log_date < day(today)).toBe(true);
    }
  });

  it("maps every date to the portal's cell, for every period-start weekday", () => {
    for (let shift = 0; shift < 7; shift++) {
      // Arrange
      const t = addDays(today, shift);
      const start = addDays(t, -25);
      const days = fullGrid();
      // Act
      const rows = planHistory({ periodStart: start, today: t, days });
      // Assert
      for (const r of rows) {
        const key = getCurrentDayKey(start.toISOString(), new Date(`${r.log_date}T00:00:00Z`));
        expect(r.program_day_id).toBe(`d-${key.week_number}-${key.day_of_week}`);
      }
    }
  });

  it("maps period days 21-24 to week 4", () => {
    // Arrange
    const days = fullGrid();
    // Act
    const rows = planHistory({ periodStart, today, days });
    // Assert
    const late = rows.filter((r) => r.log_date >= day(addDays(periodStart, 21)));
    expect(late.length).toBeGreaterThan(0);
    for (const r of late) expect(r.program_day_id.startsWith("d-4-")).toBe(true);
  });

  it("never logs a Sunday, a missing cell or a day with no exercises", () => {
    // Arrange
    const days = fullGrid()
      .filter((d) => !(d.week_number === 2 && d.day_of_week === "martes"))
      .map((d) => (d.week_number === 3 && d.day_of_week === "lunes" ? { ...d, exercises: [] } : d));
    // Act
    const rows = planHistory({ periodStart, today, days });
    // Assert
    for (const r of rows) {
      expect(new Date(`${r.log_date}T00:00:00Z`).getUTCDay()).not.toBe(0);
      expect(r.program_day_id).not.toBe("d-2-martes");
      expect(r.program_day_id).not.toBe("d-3-lunes");
    }
  });

  it("skips 2-3 loggable days, leaves 1-2 partial and completes the rest", () => {
    // Arrange
    const days = fullGrid();
    // Act
    const rows = planHistory({ periodStart, today, days });
    // Assert — 25 días pasados, menos domingos = días registrables.
    const loggable = Array.from({ length: 25 }, (_, k) => addDays(periodStart, k)).filter((d) => d.getUTCDay() !== 0).length;
    const skipped = loggable - rows.length;
    const partial = rows.filter((r) => !r.completed).length;
    expect(skipped).toBeGreaterThanOrEqual(2);
    expect(skipped).toBeLessThanOrEqual(3);
    expect(partial).toBeGreaterThanOrEqual(1);
    expect(partial).toBeLessThanOrEqual(2);
    for (const r of rows.filter((r) => r.completed)) {
      expect(Object.values(r.exercises_done).every((e) => e.completed)).toBe(true);
      expect(Object.keys(r.exercises_done)).toHaveLength(2);
    }
    for (const r of rows.filter((r) => !r.completed)) {
      expect(Object.keys(r.exercises_done).length).toBeLessThan(2);
    }
  });

  it("is deterministic for the same period", () => {
    // Arrange
    const days = fullGrid();
    // Act
    const a = planHistory({ periodStart, today, days });
    const b = planHistory({ periodStart, today, days });
    // Assert
    expect(a).toEqual(b);
  });

  it("logs at most the prescribed sets and only the declared metrics", () => {
    // Arrange
    const days = fullGrid().map((d) => ({
      ...d,
      exercises: [ex(`e-${d.day_of_week}-a`, { sets: 2, metrics: ["reps_done"] }), ex(`e-${d.day_of_week}-b`)],
    }));
    // Act
    const rows = planHistory({ periodStart, today, days });
    // Assert
    for (const r of rows) {
      for (const [id, entry] of Object.entries(r.exercises_done)) {
        const decl = days.flatMap((d) => d.exercises).find((e) => e.id === id)!;
        expect(entry.series!.length).toBeLessThanOrEqual(decl.sets);
        for (const s of entry.series!) expect(Object.keys(s).sort()).toEqual([...decl.metrics].sort());
      }
    }
  });

  it("never lowers an exercise's values from one logged week to the next", () => {
    // Arrange
    const days = fullGrid();
    // Act
    const rows = planHistory({ periodStart, today, days });
    // Assert
    const byExercise = new Map<string, { date: string; reps: number; kg: number }[]>();
    for (const r of rows) {
      for (const [id, entry] of Object.entries(r.exercises_done)) {
        const reps = entry.series!.reduce((s, x) => s + (x.reps_done ?? 0), 0);
        const kg = entry.series![0].weight_kg ?? 0;
        byExercise.set(id, [...(byExercise.get(id) ?? []), { date: r.log_date, reps, kg }]);
      }
    }
    let multiWeek = 0;
    for (const points of Array.from(byExercise.values())) {
      points.sort((a, b) => a.date.localeCompare(b.date));
      if (points.length > 1) multiWeek++;
      for (let i = 1; i < points.length; i++) {
        expect(points[i].reps).toBeGreaterThanOrEqual(points[i - 1].reps);
        expect(points[i].kg).toBeGreaterThanOrEqual(points[i - 1].kg);
      }
      expect(points[points.length - 1].kg).toBeGreaterThan(points[0].kg - 1e-9);
    }
    expect(multiWeek).toBeGreaterThan(0);
  });
});
