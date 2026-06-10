import { describe, it, expect } from "vitest";
import {
  formatMXN,
  computeMRR,
  groupRevenueByMonth,
  groupClientsByProgram,
  groupRevenueByProgram,
  computeRenewalsThisMonth,
} from "@/lib/admin/finance-helpers";

// ---------------------------------------------------------------------------
// Task 1: formatMXN
// ---------------------------------------------------------------------------

describe("formatMXN", () => {
  it("formatea pesos sin decimales con separador de miles", () => {
    expect(formatMXN(0)).toBe("$0");
    expect(formatMXN(990)).toBe("$990");
    expect(formatMXN(12500)).toBe("$12,500");
  });
  it("redondea a entero", () => {
    expect(formatMXN(990.49)).toBe("$990");
  });
});

// ---------------------------------------------------------------------------
// Task 2: computeMRR
// ---------------------------------------------------------------------------

describe("computeMRR", () => {
  it("suma price_mxn de las suscripciones activas", () => {
    expect(computeMRR([{ price_mxn: 990 }, { price_mxn: 1490 }])).toBe(2480);
  });
  it("devuelve 0 sin suscripciones", () => {
    expect(computeMRR([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 3: groupRevenueByMonth
// ---------------------------------------------------------------------------

describe("groupRevenueByMonth", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("devuelve monthsBack meses terminando en el mes actual, rellenando con 0", () => {
    const result = groupRevenueByMonth([], 3, now);
    expect(result.map((r) => r.key)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(result.every((r) => r.total === 0)).toBe(true);
  });
  it("suma amount_paid por mes de invoice_date", () => {
    const invoices = [
      { amount_paid: 990, invoice_date: "2026-06-02T00:00:00Z", program_name: "X" },
      { amount_paid: 1490, invoice_date: "2026-06-20T00:00:00Z", program_name: "Y" },
      { amount_paid: 500, invoice_date: "2026-05-10T00:00:00Z", program_name: "X" },
    ];
    const result = groupRevenueByMonth(invoices, 3, now);
    expect(result.find((r) => r.key === "2026-06")!.total).toBe(2480);
    expect(result.find((r) => r.key === "2026-05")!.total).toBe(500);
    expect(result.find((r) => r.key === "2026-04")!.total).toBe(0);
  });
  it("ignora invoices fuera de la ventana", () => {
    const invoices = [{ amount_paid: 999, invoice_date: "2026-01-01T00:00:00Z", program_name: "X" }];
    const result = groupRevenueByMonth(invoices, 3, now);
    expect(result.reduce((s, r) => s + r.total, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 4: groupClientsByProgram
// ---------------------------------------------------------------------------

describe("groupClientsByProgram", () => {
  it("cuenta suscripciones por programa, orden descendente", () => {
    const subs = [
      { program_name: "CuarentaMás" },
      { program_name: "CuarentaMás" },
      { program_name: "Strong & Fit" },
    ];
    expect(groupClientsByProgram(subs)).toEqual([
      { program: "CuarentaMás", count: 2 },
      { program: "Strong & Fit", count: 1 },
    ]);
  });
  it("devuelve [] sin suscripciones", () => {
    expect(groupClientsByProgram([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 5: groupRevenueByProgram
// ---------------------------------------------------------------------------

describe("groupRevenueByProgram", () => {
  it("suma amount_paid por programa, orden descendente", () => {
    const invoices = [
      { amount_paid: 990, invoice_date: "2026-06-01T00:00:00Z", program_name: "CuarentaMás" },
      { amount_paid: 990, invoice_date: "2026-06-01T00:00:00Z", program_name: "CuarentaMás" },
      { amount_paid: 1490, invoice_date: "2026-06-01T00:00:00Z", program_name: "Strong & Fit" },
    ];
    expect(groupRevenueByProgram(invoices)).toEqual([
      { program: "CuarentaMás", total: 1980 },
      { program: "Strong & Fit", total: 1490 },
    ]);
  });
  it("devuelve [] sin invoices", () => {
    expect(groupRevenueByProgram([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 6: computeRenewalsThisMonth
// ---------------------------------------------------------------------------

describe("computeRenewalsThisMonth", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("cuenta subs que vencen en <=30 días y suma su price_mxn", () => {
    const subs = [
      { current_period_end: "2026-06-20T00:00:00Z", price_mxn: 990 },
      { current_period_end: "2026-07-10T00:00:00Z", price_mxn: 1490 },
      { current_period_end: "2026-08-01T00:00:00Z", price_mxn: 500 },
    ];
    expect(computeRenewalsThisMonth(subs, now)).toEqual({ count: 2, amount: 2480 });
  });
  it("ignora vencimientos pasados y nulos", () => {
    const subs = [
      { current_period_end: "2026-06-01T00:00:00Z", price_mxn: 990 },
      { current_period_end: null, price_mxn: 1490 },
    ];
    expect(computeRenewalsThisMonth(subs, now)).toEqual({ count: 0, amount: 0 });
  });
});
