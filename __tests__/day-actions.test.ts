// __tests__/day-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; op: string; payload?: unknown }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      insert: (payload: unknown) => {
        calls.push({ table, op: "insert", payload });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "new-id" }, error: null }) }) };
      },
      update: (payload: unknown) => {
        calls.push({ table, op: "update", payload });
        return { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "d1" }, error: null }) }) }) };
      },
      delete: () => {
        calls.push({ table, op: "delete" });
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveDay, saveBlocks } from "@/lib/admin/dayActions";

beforeEach(() => { calls.length = 0; });

describe("saveDay", () => {
  it("inserts when no id is provided", async () => {
    const res = await saveDay({
      seriesId: "s1", weekNumber: 1, dayOfWeek: "lunes", title: "Piernas",
      workoutFocus: "Tren Inferior", dayType: "workout", durationMinutes: 40, published: false,
    });
    expect(res.dayId).toBe("new-id");
    expect(calls.find((c) => c.op === "insert")?.table).toBe("program_days");
  });

  it("updates when an id is provided", async () => {
    const res = await saveDay({
      id: "d1", seriesId: "s1", weekNumber: 1, dayOfWeek: "lunes", title: "Piernas",
      workoutFocus: null, dayType: "rest", durationMinutes: null, published: true,
    });
    expect(res.dayId).toBe("d1");
    expect(calls.find((c) => c.op === "update")?.table).toBe("program_days");
  });
});

describe("saveBlocks", () => {
  it("deletes existing blocks then inserts the new list with sort_order", async () => {
    await saveBlocks("d1", [
      { block_type: "text", content: { html: "<p>a</p>" } },
      { block_type: "cardio_zone2", content: {} },
    ]);
    expect(calls[0]).toMatchObject({ table: "program_day_blocks", op: "delete" });
    const inserted = calls.find((c) => c.op === "insert");
    expect(inserted?.table).toBe("program_day_blocks");
    expect((inserted?.payload as unknown[]).length).toBe(2);
  });
});
