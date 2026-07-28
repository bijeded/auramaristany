import { describe, it, expect } from "vitest";
import { mapSubscription, mapInvoices, accountProgressLabel } from "@/lib/portal/account-queries";

describe("mapSubscription", () => {
  it("aplana los joins a un objeto plano", () => {
    const raw = [{
      status: "active", cancel_at_period_end: false, enrollment_date: "2026-01-10", current_period_end: "2026-07-10T00:00:00Z",
      months_elapsed: 3,
      content_variant_id: "var-2", content_ordinal: 2, content_loops: 0,
      program_variants: { name: "Intermedio", price_mxn: 999, programs: { name: "Fuerza", duration_months: 6, billing_model: "fixed_term_monthly" } },
    }];
    expect(mapSubscription(raw)).toEqual({
      program_name: "Fuerza", variant_name: "Intermedio", status: "active",
      cancel_at_period_end: false,
      enrollment_date: "2026-01-10", current_period_end: "2026-07-10T00:00:00Z",
      price_mxn: 999, months_elapsed: 3, duration_months: 6,
      billing_model: "fixed_term_monthly",
      content_variant_id: "var-2", content_ordinal: 2, content_loops: 0,
      // El nombre del peldaño se resuelve fuera del mapeo, con otra consulta.
      rung_name: null,
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

describe("accountProgressLabel", () => {
  const base = {
    program_name: "Fuerza", variant_name: "Principiante", status: "active",
    cancel_at_period_end: false, enrollment_date: "2026-01-10",
    current_period_end: null, price_mxn: 999,
    months_elapsed: 3, duration_months: 6, billing_model: "fixed_term_monthly",
    content_variant_id: "var-1", content_ordinal: 3, content_loops: 0,
    rung_name: "Principiante",
  };

  it("formatea Mes X de Y en plazo fijo", () => {
    expect(accountProgressLabel(base)).toEqual({ text: "Mes 3 de 6", percent: 50 });
  });

  it("en rolling muestra el peldaño y la posición del puntero", () => {
    expect(
      accountProgressLabel({
        ...base,
        billing_model: "rolling_monthly",
        duration_months: null,
        months_elapsed: 14,
        rung_name: "Avanzado",
        content_ordinal: 2,
      })
    ).toEqual({ text: "Avanzado · Mes 2", percent: null });
  });
});
