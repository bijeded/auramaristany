import { describe, it, expect } from "vitest";
import {
  contentRunway,
  RUNWAY_THRESHOLD,
  type RunwayCandidate,
} from "@/lib/admin/content-runway";

function candidate(over: Partial<RunwayCandidate> = {}): RunwayCandidate {
  return {
    subscriptionId: "sub-1",
    clientId: "cli-1",
    clientName: "Ana",
    programName: "Strong & Fit",
    rungName: "Avanzado",
    contentOrdinal: 5,
    contentLoops: 0,
    rungOrdinals: [1, 2, 3, 4, 5, 6],
    nextRung: null,
    billingModel: "rolling_monthly",
    durationMonths: null,
    monthsElapsed: 5,
    ...over,
  };
}

describe("contentRunway", () => {
  it("avisa de la cliente que va a terminar el último peldaño", () => {
    // Arrange: en la 5 de 6 → le queda 1
    const rows = contentRunway([candidate()]);

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0].remaining).toBe(1);
    expect(rows[0].kind).toBe("will_repeat");
  });

  it("no avisa de quien tiene contenido de sobra por delante", () => {
    const rows = contentRunway([candidate({ contentOrdinal: 1 })]);

    expect(rows).toEqual([]);
  });

  it("marca como urgente el peldaño siguiente declarado y vacío", () => {
    const rows = contentRunway([
      candidate({
        rungName: "Principiante",
        nextRung: { name: "Intermedio", ordinalCount: 0 },
      }),
    ]);

    expect(rows[0].kind).toBe("next_rung_empty");
    expect(rows[0].nextRungName).toBe("Intermedio");
  });

  it("no avisa si el peldaño siguiente ya tiene contenido: ahí va a entrar", () => {
    const rows = contentRunway([
      candidate({ nextRung: { name: "Intermedio", ordinalCount: 6 } }),
    ]);

    expect(rows).toEqual([]);
  });

  it("pone el caso urgente por delante del que sólo va a repetir", () => {
    const rows = contentRunway([
      candidate({ subscriptionId: "a", clientName: "Ana" }),
      candidate({
        subscriptionId: "b",
        clientName: "Bea",
        nextRung: { name: "Intermedio", ordinalCount: 0 },
      }),
    ]);

    expect(rows.map((r) => r.subscriptionId)).toEqual(["b", "a"]);
  });

  it("dentro del mismo tipo, primero quien menos contenido le queda", () => {
    const rows = contentRunway([
      candidate({ subscriptionId: "a", contentOrdinal: 4 }), // quedan 2
      candidate({ subscriptionId: "b", contentOrdinal: 6 }), // queda 0
    ]);

    expect(rows.map((r) => r.subscriptionId)).toEqual(["b", "a"]);
  });

  it("cuenta sólo las posiciones que existen por encima, no la diferencia de ordinales", () => {
    // Huecos: en la 2 de [1,2,4] quedan 1 posiciones, no 2.
    const rows = contentRunway([
      candidate({ contentOrdinal: 2, rungOrdinals: [1, 2, 4] }),
    ]);

    expect(rows[0].remaining).toBe(1);
  });

  it("ignora un plazo fijo: ni da la vuelta ni cambia de peldaño", () => {
    const rows = contentRunway([
      candidate({
        billingModel: "fixed_term_monthly",
        durationMonths: 6,
        contentOrdinal: 6,
      }),
    ]);

    expect(rows).toEqual([]);
  });

  it("una cliente que ya está repitiendo sigue en la lista", () => {
    const rows = contentRunway([
      candidate({ contentOrdinal: 6, contentLoops: 2 }),
    ]);

    expect(rows[0].remaining).toBe(0);
    expect(rows[0].contentLoops).toBe(2);
  });

  it("el umbral es configurable y por defecto es RUNWAY_THRESHOLD", () => {
    const sub = candidate({ contentOrdinal: 3 }); // quedan 3
    expect(contentRunway([sub])).toEqual([]);
    expect(contentRunway([sub], 3)).toHaveLength(1);
    expect(RUNWAY_THRESHOLD).toBe(2);
  });
});
