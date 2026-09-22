// __tests__/day-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; op: string; payload?: unknown }[] = [];

const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
let rpcError: { code?: string; message: string } | null = null;

const fakeSupabase = {
  // `function` a propósito: el rpc real de supabase-js lee `this`. Un fake con
  // arrow function ocultaría una llamada desligada de su receptor (regla 10).
  rpc: function (this: unknown, fn: string, args: Record<string, unknown>) {
    if (this !== fakeSupabase) throw new Error("rpc called without its receiver");
    rpcCalls.push({ fn, args });
    return Promise.resolve({ data: null, error: rpcError });
  },
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
};
vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn(async () => ({ ok: true, supabase: fakeSupabase, user: { id: "admin1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveDay, saveBlocks } from "@/lib/admin/dayActions";

beforeEach(() => { calls.length = 0; rpcCalls.length = 0; rpcError = null; });

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
  it("writes the whole list in one rpc call with sanitized html and sort_order", async () => {
    const res = await saveBlocks("d1", [
      { block_type: "text", content: { html: '<p>a</p><script>x</script>' } },
      { block_type: "youtube", content: { video_id: "abc", title: "t" } },
    ]);
    expect(res).toEqual({});
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe("save_day_blocks");
    expect(rpcCalls[0].args.p_day_id).toBe("d1");
    const blocks = rpcCalls[0].args.p_blocks as { block_type: string; sort_order: number; content: { html?: string } }[];
    expect(blocks.map((b) => [b.block_type, b.sort_order])).toEqual([["text", 0], ["youtube", 1]]);
    expect(blocks[0].content.html).not.toContain("<script>");
  });

  it("never deletes or inserts through separate calls", async () => {
    await saveBlocks("d1", [{ block_type: "text", content: { html: "<p>a</p>" } }]);
    expect(calls).toHaveLength(0);
  });

  it("sends an empty list so an emptied day is saved", async () => {
    await saveBlocks("d1", []);
    expect(rpcCalls[0].args.p_blocks).toEqual([]);
  });

  it("returns a generic error when the rpc fails", async () => {
    rpcError = { code: "23514", message: "violates check constraint" };
    const res = await saveBlocks("d1", [{ block_type: "text", content: { html: "<p>a</p>" } }]);
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("check constraint");
  });

  it("refuses an invalid block before calling the rpc", async () => {
    const res = await saveBlocks("d1", [{ block_type: "nope", content: {} }]);
    expect(res.error).toBeTruthy();
    expect(rpcCalls).toHaveLength(0);
  });
});
