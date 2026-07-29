import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Fake Supabase ──────────────────────────────────────────────────
// Registra TODA escritura, no sólo la que esperamos: el defecto que este test
// vigila es precisamente que el orden se guarde a trozos, así que un `update`
// por pregunta tiene que ser visible aquí para poder fallar.
const calls: { op: string; table?: string; fn?: string; args?: unknown }[] = [];
let rpcError: { code: string; message: string } | null = null;
let adminOk = true;
// Cuántas filas dice la base que tocó. `null` = "una por par", el caso sano;
// los tests del desajuste lo fijan a mano.
let rpcRowsUpdated: number | null = null;

const fakeSupabase = {
  from: (table: string) => ({
    update: (payload: unknown) => ({
      eq: (_col: string, val: unknown) => {
        calls.push({ op: "update", table, args: { payload, id: val } });
        return Promise.resolve({ error: null });
      },
    }),
  }),
  rpc: (fn: string, args: unknown) => {
    calls.push({ op: "rpc", fn, args });
    // La función de la base deduce ella misma cuántas filas espera tocar y
    // levanta si no coinciden, deshaciendo la llamada entera. El fake imita
    // eso: desajuste ⇒ error, nunca "ok con conteo raro", porque ese estado no
    // existe del otro lado.
    const { payload } = args as { payload: unknown[] };
    const touched = rpcRowsUpdated ?? payload.length;
    if (rpcError) return Promise.resolve({ data: null, error: rpcError });
    if (touched !== payload.length) {
      return Promise.resolve({
        data: null,
        error: { message: `orden parcial: ${touched} de ${payload.length} preguntas` },
      });
    }
    return Promise.resolve({ data: touched, error: null });
  },
};

vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn(async () =>
    adminOk
      ? { ok: true, supabase: fakeSupabase }
      : { ok: false, error: "No autorizado." }
  ),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { reorderQuestions } from "@/lib/admin/onboardingActions";

// Ids reales: la acción valida que sean uuid antes de tocar la base.
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  calls.length = 0;
  rpcError = null;
  adminOk = true;
  rpcRowsUpdated = null;
});

describe("reorderQuestions", () => {
  it("guarda el orden completo en UNA sola escritura", async () => {
    // Act
    const r = await reorderQuestions([A, B, C]);

    // Assert — una escritura, no una por pregunta. Con el bucle anterior esto
    // veía tres `update` y ningún `rpc`.
    expect(r.error).toBeUndefined();
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
    expect(calls.filter((c) => c.op === "rpc")).toHaveLength(1);
  });

  it("manda las posiciones que calcula reindexOrder, desde 0 y consecutivas", async () => {
    // Act
    await reorderQuestions([A, B, C]);

    // Assert
    const rpc = calls.find((c) => c.op === "rpc");
    expect(rpc?.fn).toBe("reorder_onboarding_questions");
    expect(rpc?.args).toEqual({
      payload: [
        { id: A, sort_order: 0 },
        { id: B, sort_order: 1 },
        { id: C, sort_order: 2 },
      ],
    });
  });

  it("una lista vacía no escribe nada", async () => {
    // Act
    const r = await reorderQuestions([]);

    // Assert
    expect(r.error).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  // Un server action es un endpoint: lo que llega del navegador se valida aquí,
  // no se confía por venir del propio componente.
  it("rechaza ids que no son uuid sin tocar la base", async () => {
    // Act
    const r = await reorderQuestions(["no-soy-un-uuid", B]);

    // Assert
    expect(r.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("rechaza una lista desproporcionada sin tocar la base", async () => {
    // Arrange — el cuestionario no se acerca a 200 preguntas
    const many = Array.from({ length: 201 }, (_, i) =>
      `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`
    );

    // Act
    const r = await reorderQuestions(many);

    // Assert
    expect(r.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("si la escritura falla devuelve error genérico y no filtra el detalle de Postgres", async () => {
    // Arrange
    rpcError = { code: "42883", message: "function reorder_onboarding_questions(jsonb) does not exist" };

    // Act
    const r = await reorderQuestions([A]);

    // Assert
    expect(r.error).toBeTruthy();
    expect(r.error).not.toContain("42883");
    expect(r.error).not.toContain("does not exist");
  });

  // Sin esta comprobación la acción devolvía éxito aunque la escritura no
  // hubiera tocado todo: la admin veía su orden nuevo pintado y al recargar
  // volvía el viejo. Pasa si una pregunta se borró en otra pestaña, si va
  // repetida, o si RLS la filtra. Vive DENTRO de la función para que el update
  // se deshaga: "error" tiene que seguir significando "no se escribió nada".
  it("si no se actualizaron todas las preguntas, falla en vez de mentir", async () => {
    // Arrange — se piden 3, la base sólo tocó 2
    rpcRowsUpdated = 2;

    // Act
    const r = await reorderQuestions([A, B, C]);

    // Assert
    expect(r.error).toBeTruthy();
  });

  it("cero filas tocadas también falla", async () => {
    // Arrange — es lo que ve alguien a quien RLS no deja escribir
    rpcRowsUpdated = 0;

    // Act
    const r = await reorderQuestions([A]);

    // Assert
    expect(r.error).toBeTruthy();
  });

  it("quien no es admin no escribe nada", async () => {
    // Arrange
    adminOk = false;

    // Act
    const r = await reorderQuestions([A, B]);

    // Assert — la autorización sigue siendo de requireAdmin; esta tarea cambia
    // cómo se escribe, no quién puede escribir.
    expect(r.error).toBe("No autorizado.");
    expect(calls).toHaveLength(0);
  });
});
