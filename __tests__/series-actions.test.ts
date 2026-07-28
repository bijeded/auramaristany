import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Fake Supabase ──────────────────────────────────────────────────
const calls: { table: string; op: string; payload?: unknown }[] = [];
let insertSeriesError: { code: string; message: string } | null = null;
let insertMapError: { code: string; message: string } | null = null;

let previousMappings: MapRow[] = [];

const fakeSupabase = {
  from: (table: string) => ({
    select: (_cols: string) => ({
      eq: (_col: string, _val: string) =>
        Promise.resolve({ data: previousMappings, error: null }),
    }),
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

type MapRow = { program_variant_id: string; series_id: string; ordinal: number };

// zod exige uuid en variantId
const V1 = "11111111-1111-4111-8111-111111111111";
const V3 = "33333333-3333-4333-8333-333333333333";
const V4 = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  calls.length = 0;
  insertSeriesError = null;
  insertMapError = null;
  previousMappings = [];
});

// ─── createSeries ───────────────────────────────────────────────────
describe("createSeries", () => {
  it("inserta la serie y un mapeo por variante, cada uno con su posición", async () => {
    const result = await createSeries("prog-1", {
      title: "Fundamentos",
      description: null,
      mappings: [
        { variantId: "11111111-1111-4111-8111-111111111111", ordinal: 1 },
        { variantId: "22222222-2222-4222-8222-222222222222", ordinal: 1 },
      ],
    });

    expect(result.error).toBeUndefined();
    const mapInsert = calls.find(
      (c) => c.table === "variant_series_map" && c.op === "insert"
    );
    expect(mapInsert!.payload as MapRow[]).toEqual([
      { program_variant_id: "11111111-1111-4111-8111-111111111111", series_id: "new-series-id", ordinal: 1 },
      { program_variant_id: "22222222-2222-4222-8222-222222222222", series_id: "new-series-id", ordinal: 1 },
    ]);
  });

  it("la serie ya no lleva número: la posición vive en el mapeo", async () => {
    await createSeries("prog-1", {
      title: "T",
      description: null,
      mappings: [{ variantId: V1, ordinal: 3 }],
    });

    const seriesInsert = calls.find(
      (c) => c.table === "program_series" && c.op === "insert"
    );
    expect(seriesInsert!.payload).not.toHaveProperty("series_number");
    expect(seriesInsert!.payload).not.toHaveProperty("ordinal");
  });

  it("rechaza una serie sin variantes y no escribe nada", async () => {
    const result = await createSeries("prog-1", {
      title: "Huérfana",
      description: null,
      mappings: [],
    });

    // Sin variante no tiene posición: no es que quede inalcanzable, es que no
    // se puede representar en ningún currículo.
    expect(result.error).toBe("Elige al menos una variante para esta serie.");
    expect(calls).toHaveLength(0);
  });

  it("traduce el 23505 del mapeo a un error de posición ocupada", async () => {
    insertMapError = { code: "23505", message: "unique violation" };

    const result = await createSeries("prog-1", {
      title: "Dup",
      description: null,
      mappings: [{ variantId: V1, ordinal: 2 }],
    });

    expect(result.error).toBe("Esta variante ya tiene un Mes 2.");
    // Discriminador explícito: el modal lo pinta inline en el campo Mes #, sin
    // buscar texto dentro del mensaje.
    expect(result.field).toBe("ordinal");
  });

  it("borra la serie si el mapeo falla, para no dejarla huérfana e invisible", async () => {
    insertMapError = { code: "23505", message: "unique violation" };

    await createSeries("prog-1", {
      title: "Dup",
      description: null,
      mappings: [{ variantId: V1, ordinal: 2 }],
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
      title: "Mes actualizado",
      description: "Nueva desc",
      published: true,
      mappings: [{ variantId: V1, ordinal: 1 }],
    });

    expect(result.error).toBeUndefined();
    const upd = calls.find((c) => c.table === "program_series" && c.op === "update");
    expect((upd?.payload as { title: string })?.title).toBe("Mes actualizado");
    expect((upd?.payload as { published: boolean })?.published).toBe(true);
  });

  it("reconcilia variantes: elimina viejos e inserta los nuevos con su posición", async () => {
    await updateSeries("series-1", "prog-1", {
      title: "T",
      description: null,
      published: false,
      mappings: [
        { variantId: V3, ordinal: 4 },
        { variantId: V4, ordinal: 9 },
      ],
    });

    expect(
      calls.find((c) => c.table === "variant_series_map" && c.op === "delete")
    ).toBeTruthy();
    const mapInsert = calls.find(
      (c) => c.table === "variant_series_map" && c.op === "insert"
    );
    // Cada fila lleva SU posición: v4 conserva la suya en vez de heredar la de v3.
    expect((mapInsert!.payload as MapRow[]).map((r) => r.ordinal)).toEqual([4, 9]);
  });

  it("traduce el 23505 del mapeo a un error de posición ocupada", async () => {
    insertMapError = { code: "23505", message: "unique violation" };

    const result = await updateSeries("series-1", "prog-1", {
      title: "T",
      description: null,
      published: false,
      mappings: [{ variantId: V1, ordinal: 5 }],
    });

    expect(result.error).toBe("Esta variante ya tiene un Mes 5.");
    expect(result.field).toBe("ordinal");
  });

  it("restaura los mapeos anteriores si la inserción falla", async () => {
    // Sin esto, un 23505 (posición ocupada — un error que el admin provoca a
    // diario) dejaría la serie mapeada a CERO variantes: invisible en todos los
    // currículos e irrecuperable desde el editor.
    previousMappings = [
      { program_variant_id: V1, series_id: "series-1", ordinal: 2 },
    ];
    insertMapError = { code: "23505", message: "unique violation" };

    await updateSeries("series-1", "prog-1", {
      title: "T",
      description: null,
      published: false,
      mappings: [{ variantId: V3, ordinal: 5 }],
    });

    const mapInserts = calls.filter(
      (c) => c.table === "variant_series_map" && c.op === "insert"
    );
    expect(mapInserts).toHaveLength(2);
    expect(mapInserts[1].payload as MapRow[]).toEqual(previousMappings);
  });

  it("rechaza dejar la serie sin variantes", async () => {
    const result = await updateSeries("series-1", "prog-1", {
      title: "T",
      description: null,
      published: false,
      mappings: [],
    });

    expect(result.error).toBe("Elige al menos una variante para esta serie.");
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
