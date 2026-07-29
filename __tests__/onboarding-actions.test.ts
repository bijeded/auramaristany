import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Fake Supabase ──────────────────────────────────────────────────
// Registra TODA escritura, no sólo la que esperamos: el defecto que este test
// vigila es precisamente que el orden se guarde a trozos, así que un `update`
// por pregunta tiene que ser visible aquí para poder fallar.
const calls: { op: string; table?: string; fn?: string; args?: unknown }[] = [];
let rpcError: { code: string; message: string } | null = null;
let adminOk = true;

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
    return Promise.resolve({ error: rpcError });
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

beforeEach(() => {
  calls.length = 0;
  rpcError = null;
  adminOk = true;
});

describe("reorderQuestions", () => {
  it("guarda el orden completo en UNA sola escritura", async () => {
    // Arrange
    const ids = ["q-a", "q-b", "q-c"];

    // Act
    const r = await reorderQuestions(ids);

    // Assert — una escritura, no una por pregunta. Con el bucle anterior esto
    // veía tres `update` y ningún `rpc`.
    expect(r.error).toBeUndefined();
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
    expect(calls.filter((c) => c.op === "rpc")).toHaveLength(1);
  });

  it("manda las posiciones que calcula reindexOrder, desde 0 y consecutivas", async () => {
    // Act
    await reorderQuestions(["q-a", "q-b", "q-c"]);

    // Assert
    const rpc = calls.find((c) => c.op === "rpc");
    expect(rpc?.fn).toBe("reorder_onboarding_questions");
    expect(rpc?.args).toEqual({
      payload: [
        { id: "q-a", sort_order: 0 },
        { id: "q-b", sort_order: 1 },
        { id: "q-c", sort_order: 2 },
      ],
    });
  });

  it("una lista vacía no escribe nada", async () => {
    // Act
    const r = await reorderQuestions([]);

    // Assert — sin ids no hay orden que aplicar; llamar igualmente dejaría a la
    // función de la base recorriendo un payload vacío sin motivo.
    expect(r.error).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it("si la escritura falla devuelve error genérico y no filtra el detalle de Postgres", async () => {
    // Arrange
    rpcError = { code: "42883", message: "function reorder_onboarding_questions(jsonb) does not exist" };

    // Act
    const r = await reorderQuestions(["q-a"]);

    // Assert
    expect(r.error).toBeTruthy();
    expect(r.error).not.toContain("42883");
    expect(r.error).not.toContain("does not exist");
  });

  it("quien no es admin no escribe nada", async () => {
    // Arrange
    adminOk = false;

    // Act
    const r = await reorderQuestions(["q-a", "q-b"]);

    // Assert — la autorización sigue siendo de requireAdmin; esta tarea cambia
    // cómo se escribe, no quién puede escribir.
    expect(r.error).toBe("No autorizado.");
    expect(calls).toHaveLength(0);
  });
});
