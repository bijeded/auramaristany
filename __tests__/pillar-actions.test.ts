import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; op: string }[] = [];
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
let rpcError: { code?: string; message: string } | null = null;
const fakeSupabase = {
  // `function` a propósito: el rpc real lee `this` (regla 10).
  rpc: function (this: unknown, fn: string, args: Record<string, unknown>) {
    if (this !== fakeSupabase) throw new Error("rpc called without its receiver");
    rpcCalls.push({ fn, args });
    return Promise.resolve({ data: null, error: rpcError });
  },
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

import { savePillar, savePillarBlocks } from "@/lib/admin/pillarActions";

beforeEach(() => { calls.length = 0; rpcCalls.length = 0; rpcError = null; });

describe("savePillar", () => {
  it("upserts the pillar and returns its id", async () => {
    const res = await savePillar({ seriesId: "s1", pillarKey: "alimentacion", title: "Mes 1", published: true });
    expect(res.pillarId).toBe("p1");
    expect(calls[0]).toMatchObject({ table: "program_series_pillars", op: "upsert" });
  });
});

describe("savePillarBlocks", () => {
  it("writes the whole list in one rpc call with sanitized html and sort_order", async () => {
    const res = await savePillarBlocks("p1", [
      { block_type: "text", content: { html: "<p>a</p><script>x</script>" } },
      { block_type: "cardio_zone2", content: {} },
    ]);
    expect(res).toEqual({});
    expect(calls).toHaveLength(0);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe("save_pillar_blocks");
    expect(rpcCalls[0].args.p_pillar_id).toBe("p1");
    const blocks = rpcCalls[0].args.p_blocks as { block_type: string; sort_order: number; content: { html?: string } }[];
    expect(blocks.map((b) => [b.block_type, b.sort_order])).toEqual([["text", 0], ["cardio_zone2", 1]]);
    expect(blocks[0].content.html).not.toContain("<script>");
  });

  it("returns a generic error when the rpc fails", async () => {
    rpcError = { code: "23514", message: "violates check constraint" };
    const res = await savePillarBlocks("p1", [{ block_type: "text", content: { html: "<p>a</p>" } }]);
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("check constraint");
  });

  it("refuses an invalid block before calling the rpc", async () => {
    const res = await savePillarBlocks("p1", [{ block_type: "nope", content: {} }]);
    expect(res.error).toBeTruthy();
    expect(rpcCalls).toHaveLength(0);
  });
});
