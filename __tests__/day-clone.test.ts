// __tests__/day-clone.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fake in-memory DB
// ---------------------------------------------------------------------------
let dayRows: Record<string, unknown>[] = [];
let blockRows: Record<string, unknown>[] = [];
const inserts: { table: string; payload: unknown }[] = [];

// ---------------------------------------------------------------------------
// Fake Supabase client
//
// Encadenamiento real de cloneDay / cloneWeek (leído de lib/admin/dayActions.ts):
//
// cloneDay:
//   1. .from("program_days").select(...).eq("id", src).single()
//   2. .from("program_day_blocks").select(...).eq("day_id", src).order("sort_order")
//   3. .from("program_days").select("id").eq("series_id",...).eq("week_number",...).eq("day_of_week",...).maybeSingle()
//   4. .from("program_days").insert({...}).select("id").single()
//   5. .from("program_day_blocks").insert(...)     (sin select final)
//
// cloneWeek:
//   .from("program_days").select("id,day_of_week").eq("series_id",...).eq("week_number",...) → Promise<{data}>
//
// deleteDay (pre-existente):
//   .from("program_day_blocks").delete().eq("day_id", ...)
//   .from("program_days").delete().eq("id", ...)
// ---------------------------------------------------------------------------

function makeClient() {
  return {
    from: (table: string) => ({
      // ---- SELECT chain ----
      select: (_cols?: string) => ({
        // Primera eq (ej. .eq("id", src) o .eq("series_id", ...) o .eq("day_id", ...))
        eq: (col1: string, val1: unknown) => ({
          // Fin de cadena con un solo eq → .single() | .order()
          single: () =>
            Promise.resolve({
              data:
                (dayRows as Record<string, unknown>[]).find(
                  (r) => r[col1] === val1
                ) ?? null,
              error: null,
            }),
          order: (_c?: string) =>
            Promise.resolve({ data: blockRows, error: null }),

          // Segunda eq (ej. .eq("week_number",...) o directo a Promise para cloneWeek)
          eq: (col2: string, val2: unknown) => ({
            // cloneWeek: .eq("series_id",...).eq("week_number",...) → resolve directo
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve({ data: dayRows, error: null }).then(resolve),

            // cloneDay chequeo celda destino: triple eq → .maybeSingle()
            eq: (_col3: string, _val3: unknown) => ({
              maybeSingle: () => {
                // La celda destino NO existe en nuestros tests (queremos "vacía")
                return Promise.resolve({ data: null, error: null });
              },
            }),

            // Fallback single/order en caso de doble eq
            single: () =>
              Promise.resolve({
                data:
                  (dayRows as Record<string, unknown>[]).find(
                    (r) => r[col1] === val1 && r[col2] === val2
                  ) ?? null,
                error: null,
              }),
            order: (_c?: string) =>
              Promise.resolve({ data: dayRows, error: null }),
          }),
        }),
      }),

      // ---- INSERT chain ----
      insert: (payload: unknown) => {
        inserts.push({ table, payload });
        return {
          // Para program_days: .insert({...}).select("id").single()
          select: (_cols?: string) => ({
            single: () =>
              Promise.resolve({ data: { id: "new-day" }, error: null }),
          }),
          // Para program_day_blocks: .insert([...]) sin select (Promise directa)
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(resolve),
        };
      },

      // ---- DELETE chain ----
      delete: () => ({
        eq: (_col: string, _val: unknown) =>
          Promise.resolve({ error: null }),
      }),
    }),
  };
}

const fakeSupabase = makeClient();

vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn(async () => ({
    ok: true,
    supabase: fakeSupabase,
    user: { id: "admin1" },
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteDay, cloneDay, cloneWeek } from "@/lib/admin/dayActions";

beforeEach(() => {
  dayRows = [];
  blockRows = [];
  inserts.length = 0;
});

// ---------------------------------------------------------------------------
// Tests — deleteDay (pre-existente)
// ---------------------------------------------------------------------------
describe("deleteDay", () => {
  it("deletes blocks then the day without error", async () => {
    const res = await deleteDay("d1");
    expect(res.error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — cloneDay
// ---------------------------------------------------------------------------
describe("cloneDay", () => {
  it("returns error when source day not found", async () => {
    // dayRows = [] → .eq("id", "missing").single() devuelve null
    dayRows = [];
    const res = await cloneDay(
      "missing",
      { seriesId: "s1", weekNumber: 2, dayOfWeek: "lunes" },
      false
    );
    expect(res.error).toBe("Día origen no encontrado");
  });

  it("clones source day into empty target cell", async () => {
    // Un día en DB → .eq("id", "src").single() lo encuentra
    dayRows = [
      {
        id: "src",
        week_number: 1,
        day_of_week: "lunes",
        workout_focus: "fuerza",
        title: "Día 1",
        description: "desc",
        day_type: "workout",
        duration_minutes: 30,
        published: true,
      },
    ];
    // La celda destino está vacía (maybeSingle devuelve null en el fake)
    const res = await cloneDay(
      "src",
      { seriesId: "s1", weekNumber: 2, dayOfWeek: "lunes" },
      false
    );
    expect(res.error).toBeUndefined();
    expect(res.dayId).toBe("new-day");
    // Debe registrar un insert en program_days
    expect(inserts.some((i) => i.table === "program_days")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — cloneWeek
// ---------------------------------------------------------------------------
describe("cloneWeek", () => {
  it("returns error when source week has no days", async () => {
    // dayRows = [] → .eq("series_id",...).eq("week_number",...) devuelve []
    dayRows = [];
    const res = await cloneWeek("s1", 1, 2, false);
    expect(res.error).toBe("La semana origen no tiene días");
  });
});
