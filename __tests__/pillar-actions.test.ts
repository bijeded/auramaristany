import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; op: string }[] = [];
const fakeSupabase = {
  from: (table: string) => ({
    upsert: () => { calls.push({ table, op: "upsert" });
      return { select: () => ({ single: () => Promise.resolve({ data: { id: "p1" }, error: null }) }) }; },
    delete: () => { calls.push({ table, op: "delete" }); return { eq: () => Promise.resolve({ error: null }) }; },
    insert: () => { calls.push({ table, op: "insert" }); return Promise.resolve({ error: null }); },
  }),
};
vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn(async () => ({ ok: true, supabase: fakeSupabase, user: { id: "admin1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { savePillar } from "@/lib/admin/pillarActions";

beforeEach(() => { calls.length = 0; });

describe("savePillar", () => {
  it("upserts the pillar and returns its id", async () => {
    const res = await savePillar({ seriesId: "s1", pillarKey: "alimentacion", title: "Mes 1", published: true });
    expect(res.pillarId).toBe("p1");
    expect(calls[0]).toMatchObject({ table: "program_series_pillars", op: "upsert" });
  });
});
