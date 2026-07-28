import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonthPillars } from "@/lib/content/pillars";

/**
 * Cliente falso que sólo devuelve pilares para UNA serie concreta, así que el
 * resultado distingue "resolvió la serie correcta" de "no resolvió nada" —
 * ambos casos devolverían [] si los pilares estuvieran siempre vacíos.
 *
 * @param monthsElapsed  posición de la cliente en el currículo
 * @param ordinals       posiciones mapeadas a SU variante (`s<n>` = series_id)
 */
function mockSub(slug: string, monthsElapsed = 1, ordinals: number[] = [1]) {
  const SERIES_WITH_PILLARS = "s2";
  return {
    from: (table: string) => {
      if (table === "subscriptions") {
        return { select: () => ({ eq: () => ({ in: () => ({ single: () =>
          Promise.resolve({ data: {
            months_elapsed: monthsElapsed, program_variant_id: "v1",
            program_variants: { program_id: "pr1", programs: { slug } },
          } }) }) }) }) };
      }
      if (table === "variant_series_map") {
        // La posición vive en el mapeo: ya no se une con program_series.
        return { select: () => ({ eq: () => Promise.resolve({ data:
          ordinals.map((ordinal) => ({ series_id: `s${ordinal}`, ordinal })),
        }) }) };
      }
      if (table === "program_series_pillars") {
        return { select: () => ({ eq: (_c: string, seriesId: string) => ({ eq: () => ({ order: () =>
          Promise.resolve({ data: seriesId === SERIES_WITH_PILLARS
            ? [{ id: "p1", pillar_key: "alimentacion", title: "Alimentación" }]
            : [] }) }) }) }) };
      }
      // program_pillar_blocks
      return { select: () => ({ in: () => ({ order: () =>
        Promise.resolve({ data: [] }) }) }) };
    },
  };
}

function useMock(client: ReturnType<typeof mockSub>) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

describe("getCurrentMonthPillars", () => {
  it("returns [] for a non-CuarentaMás program", async () => {
    useMock(mockSub("strong-fit", 2, [1, 2, 3]));
    expect(await getCurrentMonthPillars("u1")).toEqual([]);
  });

  it("resuelve la serie por el ordinal de la variante", async () => {
    // months_elapsed 2 → ordinal 2 → s2, la única serie con pilares.
    useMock(mockSub("cuarenta-mas", 2, [1, 2, 3]));
    const result = await getCurrentMonthPillars("u1");
    expect(result.map((p) => p.pillar_key)).toEqual(["alimentacion"]);
  });

  it("no confunde la posición con otra serie del currículo", async () => {
    // months_elapsed 3 → s3, que no tiene pilares.
    useMock(mockSub("cuarenta-mas", 3, [1, 2, 3]));
    expect(await getCurrentMonthPillars("u1")).toEqual([]);
  });

  it("returns [] cuando la variante no tiene esa posición", async () => {
    useMock(mockSub("cuarenta-mas", 5, [1, 2, 3]));
    expect(await getCurrentMonthPillars("u1")).toEqual([]);
  });

  it("no asume posiciones contiguas: resuelve con un hueco en medio", async () => {
    // Ordinales 1,2,4,5 — el 3 no existe y aun así el 2 resuelve.
    useMock(mockSub("cuarenta-mas", 2, [1, 2, 4, 5]));
    const result = await getCurrentMonthPillars("u1");
    expect(result.map((p) => p.pillar_key)).toEqual(["alimentacion"]);
  });
});
