import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonthPillars } from "@/lib/content/pillars";

/**
 * Cliente falso que sólo devuelve pilares para UNA serie concreta, así que el
 * resultado distingue "resolvió la serie correcta" de "no resolvió nada" —
 * ambos casos devolverían [] si los pilares estuvieran siempre vacíos.
 *
 * @param contentOrdinal  posición de la cliente en el currículo (el puntero)
 * @param ordinals        posiciones mapeadas a SU peldaño (`s<n>` = series_id)
 */
function mockSub(slug: string, contentOrdinal = 1, ordinals: number[] = [1]) {
  const SERIES_WITH_PILLARS = "s2";
  return {
    from: (table: string) => {
      if (table === "subscriptions") {
        return { select: () => ({ eq: () => ({ in: () => ({ single: () =>
          Promise.resolve({ data: {
            content_variant_id: "v1", content_ordinal: contentOrdinal,
            program_variant_id: "v1",
            program_variants: { program_id: "pr1", programs: { slug } },
          } }) }) }) }) };
      }
      if (table === "variant_series_map") {
        // La posición vive en el mapeo, pero la consulta SIGUE uniendo con
        // program_series para exigir `published`. El fake exige las DOS
        // llamadas .eq() encadenadas: si el filtro de publicación desaparece,
        // la segunda no llega y el test falla.
        return { select: () => ({ eq: () => ({ eq: (col: string, val: unknown) => {
          expect(col).toBe("program_series.published");
          expect(val).toBe(true);
          return Promise.resolve({ data:
            ordinals.map((ordinal) => ({ series_id: `s${ordinal}`, ordinal })),
          });
        } }) }) };
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

function useMock(client: { from: (table: string) => unknown }) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

describe("getCurrentMonthPillars", () => {
  it("returns [] for a non-CuarentaMás program", async () => {
    useMock(mockSub("strong-fit", 2, [1, 2, 3]));
    expect(await getCurrentMonthPillars("u1")).toEqual([]);
  });

  it("resuelve la serie por el ordinal de la variante", async () => {
    // puntero en la posición 2 → s2, la única serie con pilares.
    useMock(mockSub("cuarenta-mas", 2, [1, 2, 3]));
    const result = await getCurrentMonthPillars("u1");
    expect(result.map((p) => p.pillar_key)).toEqual(["alimentacion"]);
  });

  it("consulta el PELDAÑO en el que entrena, no la variante que compró", async () => {
    // El caso que motiva todo el cambio: una cliente que subió de nivel —o que
    // Aura evaluó y mandó directa a Intermedio— entrena un peldaño distinto del
    // que paga. Direccionar por `program_variant_id` le serviría el contenido
    // del nivel equivocado, que en un programa de fuerza para mujeres de 40+ es
    // un problema de seguridad, no de gusto.
    const queried: string[] = [];
    const base = mockSub("cuarenta-mas", 2, [1, 2, 3]);
    useMock({
      from: (table: string) => {
        if (table === "subscriptions") {
          return { select: () => ({ eq: () => ({ in: () => ({ single: () =>
            Promise.resolve({ data: {
              content_variant_id: "v-avanzado", content_ordinal: 2,
              program_variant_id: "v-principiante",
              program_variants: { program_id: "pr1", programs: { slug: "cuarenta-mas" } },
            } }) }) }) }) };
        }
        if (table === "variant_series_map") {
          return { select: () => ({ eq: (_c: string, val: string) => {
            queried.push(val);
            return { eq: () => Promise.resolve({ data: [
              { series_id: "s1", ordinal: 1 }, { series_id: "s2", ordinal: 2 },
            ] }) };
          } }) };
        }
        return base.from(table);
      },
    });

    await getCurrentMonthPillars("u1");

    expect(queried).toEqual(["v-avanzado"]);
  });

  it("no confunde la posición con otra serie del currículo", async () => {
    // puntero en la posición 3 → s3, que no tiene pilares.
    useMock(mockSub("cuarenta-mas", 3, [1, 2, 3]));
    expect(await getCurrentMonthPillars("u1")).toEqual([]);
  });

  it("una posición en un hueco no resuelve a la serie más cercana", async () => {
    // Ordinales 1,2,4,5 y la cliente en la 3: el 3 NO existe, así que no debe
    // devolver ni el 2 ni el 4. Distingue "ordinal exacto" de "más cercano".
    useMock(mockSub("cuarenta-mas", 3, [1, 2, 4, 5]));
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
