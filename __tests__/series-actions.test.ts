import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Fake Supabase ──────────────────────────────────────────────────
const calls: { table: string; op: string; payload?: unknown }[] = [];
let insertSeriesError: { code: string; message: string } | null = null;
let insertMapError: { code: string; message: string } | null = null;

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
      return { error: insertMapError };
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
  insertMapError = null;
});

type MapRow = { program_variant_id: string; series_id: string; ordinal: number };

// ─── createSeries ───────────────────────────────────────────────────
describe("createSeries", () => {
  it("inserta la serie y un mapeo por variante, cada uno con su posición", async () => {
    const result = await createSeries("prog-1", {
      ordinal: 1,
      title: "Fundamentos",
      description: null,
      variantIds: ["v1", "v2"],
    });

    expect(result.error).toBeUndefined();
    const mapInsert = calls.find(
      (c) => c.table === "variant_series_map" && c.op === "insert"
    );
    expect(mapInsert!.payload as MapRow[]).toEqual([
      { program_variant_id: "v1", series_id: "new-series-id", ordinal: 1 },
      { program_variant_id: "v2", series_id: "new-series-id", ordinal: 1 },
    ]);
  });

  it("la serie ya no lleva número: la posición vive en el mapeo", async () => {
    await createSeries("prog-1", {
      ordinal: 3,
      title: "T",
      description: null,
      variantIds: ["v1"],
    });

    const seriesInsert = calls.find(
      (c) => c.table === "program_series" && c.op === "insert"
    );
    expect(seriesInsert!.payload).not.toHaveProperty("series_number");
    expect(seriesInsert!.payload).not.toHaveProperty("ordinal");
  });

  it("rechaza una serie sin variantes y no escribe nada", async () => {
    const result = await createSeries("prog-1", {
      ordinal: 1,
      title: "Huérfana",
      description: null,
      variantIds: [],
    });

    // Sin variante no tiene posición: no es que quede inalcanzable, es que no
    // se puede representar en ningún currículo.
    expect(result.error).toBe("Elige al menos una variante para esta serie.");
    expect(calls).toHaveLength(0);
  });

  it("traduce el 23505 del mapeo a un error de posición ocupada", async () => {
    insertMapError = { code: "23505", message: "unique violation" };

    const result = await createSeries("prog-1", {
      ordinal: 2,
      title: "Dup",
      description: null,
      variantIds: ["v1"],
    });

    expect(result.error).toBe("Ya existe un Mes 2 en alguna de las variantes elegidas.");
  });

  it("borra la serie si el mapeo falla, para no dejarla huérfana e invisible", async () => {
    insertMapError = { code: "23505", message: "unique violation" };

    await createSeries("prog-1", {
      ordinal: 2,
      title: "Dup",
      description: null,
      variantIds: ["v1"],
    });

    // Sin mapeo la serie no aparece en ningún currículo: el admin no podría
    // verla para borrarla.
    expect(
      calls.find((c) => c.table === "program_series" && c.op === "delete")
    ).toBeTruthy();
  });
});

// ─── updateSeries ───────────────────────────────────────────────────
describe("updateSeries", () => {
  it("actualiza los campos de la serie", async () => {
    const result = await updateSeries("series-1", "prog-1", {
      ordinal: 1,
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

  it("reconcilia variantes: elimina viejos e inserta los nuevos con su posición", async () => {
    await updateSeries("series-1", "prog-1", {
      ordinal: 4,
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
    expect((mapInsert!.payload as MapRow[]).every((r) => r.ordinal === 4)).toBe(true);
  });

  it("traduce el 23505 del mapeo a un error de posición ocupada", async () => {
    insertMapError = { code: "23505", message: "unique violation" };

    const result = await updateSeries("series-1", "prog-1", {
      ordinal: 5,
      title: "T",
      description: null,
      published: false,
      variantIds: ["v1"],
    });

    expect(result.error).toBe("Ya existe un Mes 5 en alguna de las variantes elegidas.");
  });

  it("rechaza dejar la serie sin variantes", async () => {
    const result = await updateSeries("series-1", "prog-1", {
      ordinal: 1,
      title: "T",
      description: null,
      published: false,
      variantIds: [],
    });

    expect(result.error).toBe("La serie debe tener al menos una variante.");
    expect(calls).toHaveLength(0);
  });
});

// ─── deleteSeries ───────────────────────────────────────────────────
describe("deleteSeries", () => {
  it("elimina el mapeo y luego la serie", async () => {
    const result = await deleteSeries("series-1", "prog-1");

    expect(result.error).toBeUndefined();
    expect(
      calls.find((c) => c.table === "variant_series_map" && c.op === "delete")
    ).toBeTruthy();
    expect(
      calls.find((c) => c.table === "program_series" && c.op === "delete")
    ).toBeTruthy();
  });
});
