// __tests__/progress-log.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertCalls: { payload: unknown; options: unknown }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (_table: string) => ({
      upsert: (payload: unknown, options: unknown) => {
        upsertCalls.push({ payload, options });
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: "log-1" }, error: null }),
          }),
        };
      },
    }),
  })),
}));

import { upsertProgressLog } from "@/lib/content/queries";

beforeEach(() => {
  upsertCalls.length = 0;
});

describe("upsertProgressLog", () => {
  it("upserts with onConflict 'profile_id,program_day_id' and returns the row id", async () => {
    const res = await upsertProgressLog({
      userId: "u1",
      subscriptionId: "sub1",
      programDayId: "day1",
      exercisesDone: { ex1: { completed: true } },
      generalNotes: "Listo",
      completed: true,
    });

    expect(res).toEqual({ id: "log-1" });
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].options).toEqual({
      onConflict: "profile_id,program_day_id",
    });
    expect(upsertCalls[0].payload).toMatchObject({
      profile_id: "u1",
      subscription_id: "sub1",
      program_day_id: "day1",
    });
    // Save bug regression: must write to the real DB column `notes`,
    // not the non-existent `general_notes`.
    const payload = upsertCalls[0].payload as Record<string, unknown>;
    expect(payload.notes).toBe("Listo");
    expect(payload).not.toHaveProperty("general_notes");
  });
});
