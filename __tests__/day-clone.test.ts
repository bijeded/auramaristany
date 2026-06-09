// __tests__/day-clone.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

let dayRows: Record<string, unknown>[] = [];
let blockRows: Record<string, unknown>[] = [];
const inserted: { table: string; payload: unknown }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: unknown) => ({
          eq: () => ({ single: () => Promise.resolve({ data: dayRows[0] ?? null }) }),
          order: () => Promise.resolve({ data: blockRows }),
          single: () => Promise.resolve({ data: dayRows.find((d) => d[col] === val) ?? null }),
          then: undefined,
        }),
      }),
      insert: (payload: unknown) => {
        inserted.push({ table, payload });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "clone-id" }, error: null }) }) };
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteDay } from "@/lib/admin/dayActions";

beforeEach(() => { dayRows = []; blockRows = []; inserted.length = 0; });

describe("deleteDay", () => {
  it("deletes blocks then the day without error", async () => {
    const res = await deleteDay("d1");
    expect(res.error).toBeUndefined();
  });
});
