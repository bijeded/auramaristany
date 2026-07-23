import { describe, it, expect } from "vitest";
import {
  formatMXN,
  computeMRR,
  groupRevenueByMonth,
  groupClientsByVariant,
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
// Task 4: groupClientsByVariant
// ---------------------------------------------------------------------------

describe("groupClientsByVariant", () => {
  it("cuenta suscripciones por variante, orden descendente", () => {
    const subs = [
      { variant_name: "CuarentaMás Principiante Poco Tiempo" },
      { variant_name: "CuarentaMás Principiante Poco Tiempo" },
      { variant_name: "Strong & Fit Intermedio" },
    ];
    expect(groupClientsByVariant(subs)).toEqual([
      { variant: "CuarentaMás Principiante Poco Tiempo", count: 2 },
      { variant: "Strong & Fit Intermedio", count: 1 },
    ]);
  });
  it("devuelve [] sin suscripciones", () => {
    expect(groupClientsByVariant([])).toEqual([]);
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

// ---------------------------------------------------------------------------
// A11: computeRenewalsWithinDays (generalization of computeRenewalsThisMonth)
// ---------------------------------------------------------------------------

import { computeRenewalsWithinDays } from "@/lib/admin/finance-helpers";

describe("computeRenewalsWithinDays", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const subs = [
    { current_period_end: "2026-06-20T00:00:00Z", price_mxn: 990 },  // +5d
    { current_period_end: "2026-07-05T00:00:00Z", price_mxn: 1490 }, // +20d
    { current_period_end: "2026-06-01T00:00:00Z", price_mxn: 500 },  // past
    { current_period_end: null, price_mxn: 700 },
  ];

  it("cuenta solo subs dentro de la ventana de 7 días", () => {
    expect(computeRenewalsWithinDays(subs, 7, now)).toEqual({ count: 1, amount: 990 });
  });

  it("con 30 días incluye también el vencimiento a 20 días", () => {
    expect(computeRenewalsWithinDays(subs, 30, now)).toEqual({ count: 2, amount: 2480 });
  });

  it("incluye el límite exacto de la ventana", () => {
    const boundary = [{ current_period_end: "2026-06-22T12:00:00Z", price_mxn: 100 }]; // exactly +7d
    expect(computeRenewalsWithinDays(boundary, 7, now)).toEqual({ count: 1, amount: 100 });
  });

  it("ignora pasados y nulos", () => {
    expect(computeRenewalsWithinDays(subs.slice(2), 7, now)).toEqual({ count: 0, amount: 0 });
  });

  it("computeRenewalsThisMonth sigue equivaliendo a la ventana de 30 días", () => {
    expect(computeRenewalsThisMonth(subs, now)).toEqual(computeRenewalsWithinDays(subs, 30, now));
  });
});

// ---------------------------------------------------------------------------
// Task 3 (payments): filterPaymentsByStatus
// ---------------------------------------------------------------------------

import { filterPaymentsByStatus, type PaymentRow } from "@/lib/admin/finance-helpers";

const pmt = (status: string): PaymentRow => ({
  invoice_date: "2026-06-01T00:00:00+00:00",
  profile_id: "p1",
  client_name: "Ana",
  program_name: "CuarentaMás",
  variant_name: "Base",
  amount_paid: 999,
  status,
});

describe("filterPaymentsByStatus", () => {
  const rows = [pmt("paid"), pmt("open"), pmt("paid"), pmt("void")];
  it("'todos' devuelve todas las filas", () => {
    expect(filterPaymentsByStatus(rows, "todos")).toHaveLength(4);
  });
  it("filtra por estado exacto", () => {
    expect(filterPaymentsByStatus(rows, "paid")).toHaveLength(2);
    expect(filterPaymentsByStatus(rows, "void")).toHaveLength(1);
    expect(filterPaymentsByStatus(rows, "uncollectible")).toHaveLength(0);
  });
});
