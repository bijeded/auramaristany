import { describe, it, expect } from "vitest";
import {
  countCompleted,
  countExercisesInBlocks,
  aggregateDayValue,
  buildPerformanceSeries,
  type ExerciseMeta,
  type LogForPerf,
} from "@/lib/content/history-helpers";

describe("countCompleted", () => {
  it("returns 0 for null/empty", () => {
    expect(countCompleted(null)).toBe(0);
    expect(countCompleted({})).toBe(0);
  });
  it("counts only entries with completed === true", () => {
    const done = {
      a: { completed: true, series: [] },
      b: { completed: false, series: [] },
      c: { completed: true, series: [] },
    };
    expect(countCompleted(done)).toBe(2);
  });
});

describe("countExercisesInBlocks", () => {
  it("sums exercises across exercise_list blocks only", () => {
    const blocks = [
      { block_type: "text", content: { html: "x" } },
      { block_type: "exercise_list", content: { exercises: [{ id: "1" }, { id: "2" }] } },
      { block_type: "exercise_list", content: { exercises: [{ id: "3" }] } },
    ];
    expect(countExercisesInBlocks(blocks)).toBe(3);
  });
  it("returns 0 when no exercise blocks", () => {
    expect(countExercisesInBlocks([{ block_type: "text", content: {} }])).toBe(0);
  });
});

describe("aggregateDayValue", () => {
  it("returns null for empty series or no numeric values", () => {
    expect(aggregateDayValue([], "weight_kg")).toBeNull();
    expect(aggregateDayValue([{ weight_kg: null }], "weight_kg")).toBeNull();
  });
  it("sums reps_done across series", () => {
    expect(aggregateDayValue([{ reps_done: 10 }, { reps_done: 12 }], "reps_done")).toBe(22);
  });
  it("averages weight_kg across series (2 decimals)", () => {
    expect(aggregateDayValue([{ weight_kg: 10 }, { weight_kg: 15 }], "weight_kg")).toBe(12.5);
  });
  it("ignores null entries when averaging", () => {
    expect(aggregateDayValue([{ weight_kg: 10 }, { weight_kg: null }], "weight_kg")).toBe(10);
  });
});

describe("buildPerformanceSeries", () => {
  const meta = new Map<string, ExerciseMeta>([
    ["ex1", { name: "Sentadilla", metrics: ["reps_done", "weight_kg"] }],
  ]);
  it("builds points per exercise sorted by date", () => {
    const logs: LogForPerf[] = [
      { logDate: "2026-06-05", exercisesDone: { ex1: { completed: true, series: [{ reps_done: 10, weight_kg: 20 }] } } },
      { logDate: "2026-06-01", exercisesDone: { ex1: { completed: true, series: [{ reps_done: 8, weight_kg: 15 }] } } },
    ];
    const result = buildPerformanceSeries(logs, meta);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Sentadilla");
    expect(result[0].points.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-05"]);
    expect(result[0].points[1].values.weight_kg).toBe(20);
  });
  it("skips exercises not present in meta (not in current month defs)", () => {
    const logs: LogForPerf[] = [
      { logDate: "2026-06-01", exercisesDone: { unknown: { completed: true, series: [{ reps_done: 5 }] } } },
    ];
    expect(buildPerformanceSeries(logs, meta)).toEqual([]);
  });
  it("omits days with no numeric value for any metric", () => {
    const logs: LogForPerf[] = [
      { logDate: "2026-06-01", exercisesDone: { ex1: { completed: false, series: [{ reps_done: null, weight_kg: null }] } } },
    ];
    expect(buildPerformanceSeries(logs, meta)[0]?.points ?? []).toEqual([]);
  });

  it("groups by normalized name across different uuids (case/space-insensitive)", () => {
    // Mismo ejercicio "Sentadilla" con distinto uuid en cada día (Aura no clonó).
    const nameMeta = new Map<string, ExerciseMeta>([
      ["uuid-a", { name: "Sentadilla", metrics: ["weight_kg"] }],
      ["uuid-b", { name: " sentadilla ", metrics: ["reps_done"] }],
    ]);
    const logs: LogForPerf[] = [
      { logDate: "2026-06-01", exercisesDone: { "uuid-a": { completed: true, series: [{ weight_kg: 20 }] } } },
      { logDate: "2026-06-08", exercisesDone: { "uuid-b": { completed: true, series: [{ reps_done: 12 }] } } },
    ];
    const result = buildPerformanceSeries(logs, nameMeta);
    expect(result).toHaveLength(1);
    expect(result[0].points.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-08"]);
    // Métricas unidas de ambos uuids, en orden de aparición.
    expect(result[0].metrics).toEqual(["weight_kg", "reps_done"]);
    expect(result[0].points[0].values.weight_kg).toBe(20);
    expect(result[0].points[1].values.reps_done).toBe(12);
  });
});
