import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Fake Supabase ──────────────────────────────────────────────────
const calls: { table: string; op: string; payload?: unknown }[] = [];
let insertSeriesError: { code: string; message: string } | null = null;

const fakeSupabase = {
  from: (table: string) => ({
    insert: (payload: unknown) => {
      calls.push({ table, op: "insert", payload });
      if (table === "program_series") {
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: insertSeriesError ? null : { id: "new-series-id" },
                error: insertSeriesError,
              }),
          }),
        };
      }
      // variant_series_map — se await directamente sin .select().single()
      return { error: null };
    },
    update: (payload: unknown) => {
      calls.push({ table, op: "update", payload });
      return { eq: (_col: string, _val: string) => Promise.resolve({ error: null }) };
    },
    delete: () => {
      calls.push({ table, op: "delete" });
      return { eq: (_col: string, _val: string) => Promise.resolve({ error: null }) };
    },
  }),
};

vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn(async () => ({
    ok: true,
    supabase: fakeSupabase,
    user: { id: "admin-1" },
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createSeries, updateSeries, deleteSeries } from "@/lib/admin/seriesActions";

beforeEach(() => {
  calls.length = 0;
  insertSeriesError = null;
});

// ─── createSeries ───────────────────────────────────────────────────
describe("createSeries", () => {
  it("inserta la serie y los mappings de variantes", async () => {
    const result = await createSeries("prog-1", {
      series_number: 1,
      title: "Fundamentos",
      description: null,
      variantIds: ["v1", "v2"],
    });
    expect(result.error).toBeUndefined();
    expect(calls.find((c) => c.table === "program_series" && c.op === "insert")).toBeTruthy();
    const mapInsert = calls.find(
      (c) => c.table === "variant_series_map" && c.op === "insert"
    );
    expect(mapInsert).toBeTruthy();
    expect((mapInsert!.payload as unknown[]).length).toBe(2);
  });

  it("retorna error si el número de serie ya existe (código 23505)", async () => {
    insertSeriesError = { code: "23505", message: "unique violation" };
    const result = await createSeries("prog-1", {
      series_number: 1,
      title: "Dup",
      description: null,
      variantIds: ["v1"],
    });
    expect(result.error).toBe("El mes 1 ya existe en este programa");
  });
});

// ─── updateSeries ───────────────────────────────────────────────────
describe("updateSeries", () => {
  it("actualiza los campos de la serie", async () => {
    const result = await updateSeries("series-1", "prog-1", {
      title: "Mes actualizado",
      description: "Nueva desc",
      published: true,
      variantIds: ["v1"],
    });
    expect(result.error).toBeUndefined();
    const upd = calls.find((c) => c.table === "program_series" && c.op === "update");
    expect((upd?.payload as { title: string })?.title).toBe("Mes actualizado");
    expect((upd?.payload as { published: boolean })?.published).toBe(true);
  });

  it("reconcilia variantes: elimina viejos e inserta los nuevos", async () => {
    await updateSeries("series-1", "prog-1", {
      title: "T",
      description: null,
      published: false,
      variantIds: ["v3", "v4"],
    });
    expect(
      calls.find((c) => c.table === "variant_series_map" && c.op === "delete")
    ).toBeTruthy();
    const mapInsert = calls.find(
      (c) => c.table === "variant_series_map" && c.op === "insert"
    );
    expect((mapInsert?.payload as unknown[]).length).toBe(2);
  });
});

// ─── deleteSeries ───────────────────────────────────────────────────
describe("deleteSeries", () => {
  it("elimina la serie de program_series", async () => {
    const result = await deleteSeries("series-1", "prog-1");
    expect(result.error).toBeUndefined();
    expect(
      calls.find((c) => c.table === "program_series" && c.op === "delete")
    ).toBeTruthy();
  });
});
