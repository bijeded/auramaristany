import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; op: string; payload?: unknown; eqArgs?: unknown[] }[] = [];
let adminOk = true;
let updateError: unknown = null;

function makeQuery(table: string) {
  const q = {
    select: () => q,
    order: () => q,
    update: (payload: unknown) => ({
      eq: (_col: string, val: unknown) => {
        calls.push({ table, op: "update", payload, eqArgs: [val] });
        return Promise.resolve({ error: updateError });
      },
    }),
  };
  return q;
}

const fakeSupabase = { from: (table: string) => makeQuery(table) };

vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn(async () =>
    adminOk
      ? { ok: true, supabase: fakeSupabase, user: { id: "admin-1" } }
      : { ok: false, error: "No autorizado" }
  ),
}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

import {
  updateAutomatedMessage,
  toggleAutomatedMessage,
} from "@/lib/admin/automatedMessageActions";
import { MESSAGE_BODY_MAX, MESSAGE_SUBJECT_MAX } from "@/lib/admin/message-helpers";

beforeEach(() => {
  calls.length = 0;
  adminOk = true;
  updateError = null;
  revalidatePath.mockClear();
});

describe("updateAutomatedMessage", () => {
  it("guarda asunto y cuerpo de una regla válida", async () => {
    // Arrange / Act
    const res = await updateAutomatedMessage({
      rule: "booking_reminder",
      subject: "Agenda tu llamada",
      body: "Hola {nombre},\n\nya puedes agendar.",
    });

    // Assert
    expect(res.error).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("automated_messages");
    expect(calls[0].payload).toEqual({
      subject: "Agenda tu llamada",
      body: "Hola {nombre},\n\nya puedes agendar.",
    });
    expect(calls[0].eqArgs).toEqual(["booking_reminder"]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/automated-messages");
  });

  it("rechaza una regla que no está en la lista blanca", async () => {
    const res = await updateAutomatedMessage({
      // @ts-expect-error entrada inválida a propósito
      rule: "arbitrary_rule",
      subject: "x",
      body: "y",
    });

    expect(res.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("rechaza asunto vacío sin escribir", async () => {
    const res = await updateAutomatedMessage({
      rule: "inactivity_nudge",
      subject: "   ",
      body: "cuerpo",
    });

    expect(res.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("rechaza cuerpo vacío sin escribir", async () => {
    const res = await updateAutomatedMessage({
      rule: "inactivity_nudge",
      subject: "asunto",
      body: "",
    });

    expect(res.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("rechaza un cuerpo que excede el límite", async () => {
    const res = await updateAutomatedMessage({
      rule: "inactivity_nudge",
      subject: "asunto",
      body: "a".repeat(MESSAGE_BODY_MAX + 1),
    });

    expect(res.error).toContain(String(MESSAGE_BODY_MAX));
    expect(calls).toHaveLength(0);
  });

  it("rechaza un asunto que excede el límite", async () => {
    const res = await updateAutomatedMessage({
      rule: "inactivity_nudge",
      subject: "a".repeat(MESSAGE_SUBJECT_MAX + 1),
      body: "cuerpo",
    });

    expect(res.error).toContain(String(MESSAGE_SUBJECT_MAX));
    expect(calls).toHaveLength(0);
  });

  it("sanea HTML del cuerpo sin romper & ni saltos de línea", async () => {
    const res = await updateAutomatedMessage({
      rule: "booking_reminder",
      subject: "Fuerza <b>y</b> salud",
      body: "<script>alert(1)</script>Fuerza & salud\n\nsegundo párrafo",
    });

    expect(res.error).toBeUndefined();
    expect(calls[0].payload).toEqual({
      subject: "Fuerza y salud",
      body: "Fuerza & salud\n\nsegundo párrafo",
    });
  });

  it("devuelve el texto SANEADO, no el enviado", async () => {
    // Sin esto el formulario se queda desincronizado: muestra lo que escribió
    // el admin, no lo que quedó guardado.
    const res = await updateAutomatedMessage({
      rule: "booking_reminder",
      subject: "  Hola <b>Aura</b>  ",
      body: "Fuerza & salud",
    });

    expect(res.error).toBeUndefined();
    expect(res.saved).toEqual({ subject: "Hola Aura", body: "Fuerza & salud" });
  });

  it("no devuelve `saved` cuando falla", async () => {
    updateError = { code: "42501", message: "rls" };
    const res = await updateAutomatedMessage({
      rule: "booking_reminder",
      subject: "asunto",
      body: "cuerpo",
    });

    expect(res.saved).toBeUndefined();
  });

  it("no escribe si quien llama no es admin", async () => {
    adminOk = false;
    const res = await updateAutomatedMessage({
      rule: "booking_reminder",
      subject: "asunto",
      body: "cuerpo",
    });

    expect(res.error).toBe("No autorizado");
    expect(calls).toHaveLength(0);
  });

  it("devuelve un mensaje genérico si Postgres falla", async () => {
    updateError = { code: "42501", message: "new row violates row-level security policy" };
    const res = await updateAutomatedMessage({
      rule: "booking_reminder",
      subject: "asunto",
      body: "cuerpo",
    });

    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("row-level security");
  });
});

describe("toggleAutomatedMessage", () => {
  it("desactiva una regla sin tocar su copia", async () => {
    const res = await toggleAutomatedMessage("inactivity_nudge", false);

    expect(res.error).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toEqual({ is_active: false });
    expect(calls[0].eqArgs).toEqual(["inactivity_nudge"]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/automated-messages");
  });

  it("reactiva una regla", async () => {
    const res = await toggleAutomatedMessage("booking_reminder", true);

    expect(res.error).toBeUndefined();
    expect(calls[0].payload).toEqual({ is_active: true });
  });

  it("rechaza una regla fuera de la lista blanca", async () => {
    // @ts-expect-error entrada inválida a propósito
    const res = await toggleAutomatedMessage("drop_table", true);

    expect(res.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("rechaza un is_active que no es booleano", async () => {
    // Los argumentos de una server action los controla el cliente.
    // @ts-expect-error entrada inválida a propósito
    const res = await toggleAutomatedMessage("booking_reminder", "sí");

    expect(res.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("no escribe si quien llama no es admin", async () => {
    adminOk = false;
    const res = await toggleAutomatedMessage("booking_reminder", false);

    expect(res.error).toBe("No autorizado");
    expect(calls).toHaveLength(0);
  });
});
