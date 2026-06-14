import { describe, it, expect } from "vitest";
import { mapSubscription, mapInvoices, progressLabel } from "@/lib/portal/account-queries";

describe("mapSubscription", () => {
  it("aplana los joins a un objeto plano", () => {
    const raw = [{
      status: "active", enrollment_date: "2026-01-10", current_period_end: "2026-07-10T00:00:00Z",
      months_elapsed: 3,
      program_variants: { name: "Intermedio", price_mxn: 999, programs: { name: "Fuerza", duration_months: 6 } },
    }];
    expect(mapSubscription(raw)).toEqual({
      program_name: "Fuerza", variant_name: "Intermedio", status: "active",
      enrollment_date: "2026-01-10", current_period_end: "2026-07-10T00:00:00Z",
      price_mxn: 999, months_elapsed: 3, duration_months: 6,
    });
  });

  it("devuelve null si no hay filas", () => {
    expect(mapSubscription([])).toBeNull();
    expect(mapSubscription(null)).toBeNull();
  });
});

describe("mapInvoices", () => {
  it("aplana y conserva el orden recibido", () => {
    const raw = [{
      amount_paid: 999, invoice_date: "2026-03-10", status: "paid",
      subscriptions: { program_variants: { programs: { name: "Fuerza" } } },
    }];
    expect(mapInvoices(raw)).toEqual([
      { amount_paid: 999, invoice_date: "2026-03-10", status: "paid", program_name: "Fuerza" },
    ]);
  });

  it("usa guion cuando falta el programa", () => {
    const raw = [{ amount_paid: 100, invoice_date: "2026-03-10", status: "open", subscriptions: null }];
    expect(mapInvoices(raw)[0].program_name).toBe("—");
  });
});

describe("progressLabel", () => {
  it("formatea Mes X de Y", () => {
    expect(progressLabel(3, 6)).toEqual({ text: "Mes 3 de 6", percent: 50 });
  });
  it("devuelve null si falta la duración", () => {
    expect(progressLabel(3, null)).toBeNull();
  });
  it("clampa el porcentaje a 100", () => {
    expect(progressLabel(8, 6)?.percent).toBe(100);
  });
});
