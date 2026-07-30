import { describe, it, expect } from "vitest";
import {
  formatMXN,
  computeMRR,
  groupRevenueByMonth,
  groupClientsByVariant,
  groupRevenueByProgram,
  computeRenewalsWithinDays,
  partitionByOutcome,
  type FinanceSubRow,
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
// A11: computeRenewalsWithinDays (generalization of computeRenewalsThisMonth)
// ---------------------------------------------------------------------------


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

// ---------------------------------------------------------------------------
// D17: partitionByOutcome — la única derivación de "¿esta suscripción cobra?"
// ---------------------------------------------------------------------------


// Sólo llegan filas `active` (getActiveSubscriptions filtra por eso), pero el
// status viaja igual y se le pasa a la derivación: si algún día se ensancha la
// consulta, la respuesta sigue siendo correcta en vez de romperse en silencio.
const sub = (o: Partial<FinanceSubRow> = {}): FinanceSubRow => ({
  current_period_end: "2026-06-20T00:00:00Z",
  price_mxn: 999,
  variant_name: "Base",
  status: "active",
  cancel_at_period_end: false,
  completed_at: null,
  ...o,
});

describe("partitionByOutcome", () => {
  it("una suscripción normal va a `billing`: volverá a cobrar", () => {
    const { billing, completing, cancelling } = partitionByOutcome([sub()]);
    expect(billing).toHaveLength(1);
    expect(completing).toHaveLength(0);
    expect(cancelling).toHaveLength(0);
  });

  // Las DOS señales = final programado. Es una graduación a CuarentaMás Extra,
  // no una baja, y por eso no cae en `cancelling`.
  it("con completed_at Y la bandera va a `completing`, no a `cancelling`", () => {
    const { billing, completing, cancelling } = partitionByOutcome([
      sub({ completed_at: "2026-06-01T00:00:00Z", cancel_at_period_end: true }),
    ]);
    expect(completing).toHaveLength(1);
    expect(cancelling).toHaveLength(0);
    expect(billing).toHaveLength(0);
  });

  it("con la bandera sola va a `cancelling`: se va por su cuenta", () => {
    const { completing, cancelling } = partitionByOutcome([sub({ cancel_at_period_end: true })]);
    expect(cancelling).toHaveLength(1);
    expect(completing).toHaveLength(0);
  });

  // `completed_at` a solas no prueba nada: L2b lo escribía sin cancelar en
  // Stripe, así que una fila vieja lo trae puesto y sigue cobrando tan campante.
  it("una marca de completado huérfana sigue en `billing`", () => {
    const { billing, completing } = partitionByOutcome([sub({ completed_at: "2026-06-01T00:00:00Z" })]);
    expect(billing).toHaveLength(1);
    expect(completing).toHaveLength(0);
  });

  it("cada fila cae en EXACTAMENTE un balde", () => {
    const rows = [
      sub(),
      sub({ cancel_at_period_end: true }),
      sub({ completed_at: "2026-06-01T00:00:00Z", cancel_at_period_end: true }),
      sub({ completed_at: "2026-06-01T00:00:00Z" }),
    ];
    const { billing, completing, cancelling, excluded } = partitionByOutcome(rows);
    expect(billing.length + completing.length + cancelling.length + excluded.length).toBe(rows.length);
    expect(excluded).toHaveLength(0); // ninguna de éstas terminó ya
  });

  // Hoy la consulta filtra por `active`, así que esto no puede pasar — y por eso
  // mismo se fija: si mañana se ensancha, una fila que ya terminó NO debe
  // desaparecer en silencio (contaría en el headcount y en ninguna cohorte), ni
  // colarse en `billing` sumando al MRR un cobro que no existe.
  it("una que ya terminó no se pierde: va a `excluded`, no a las tres", () => {
    const rows = [sub({ status: "completed" }), sub({ status: "canceled" }), sub()];
    const { billing, completing, cancelling, excluded } = partitionByOutcome(rows);
    expect(excluded).toHaveLength(2);
    expect(billing).toHaveLength(1);
    expect(completing).toHaveLength(0);
    expect(cancelling).toHaveLength(0);
    expect(billing.length + completing.length + cancelling.length + excluded.length).toBe(rows.length);
  });

  it("preserva price_mxn y variant_name, que es lo que consumen MRR y las barras", () => {
    const { billing } = partitionByOutcome([sub({ price_mxn: 1490, variant_name: "Avanzado" })]);
    expect(billing[0]).toMatchObject({ price_mxn: 1490, variant_name: "Avanzado" });
  });
});

// El invariante del dashboard: sobre una misma ventana, las tres tarjetas
// reparten exactamente las filas que vencen en ella. Ni se cuenta una dos veces
// ni se cae ninguna, y eso lo garantiza la estructura (un solo paso), no la
// disciplina de quien la use.
describe("las tres tarjetas reparten la ventana sin solaparse", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const dentro = "2026-06-20T00:00:00Z"; // +5d
  const fuera = "2026-07-20T00:00:00Z";  // +35d

  const rows: FinanceSubRow[] = [
    sub({ current_period_end: dentro }),
    sub({ current_period_end: dentro, cancel_at_period_end: true }),
    sub({ current_period_end: dentro, completed_at: "2026-06-01T00:00:00Z", cancel_at_period_end: true }),
    sub({ current_period_end: fuera }),
    sub({ current_period_end: null }),
    // Ya terminada y dentro de la ventana: no es de ninguna de las tres tarjetas.
    sub({ current_period_end: dentro, status: "canceled" }),
  ];

  it("la suma de las tres = las filas que vencen dentro de la ventana", () => {
    const { billing, completing, cancelling } = partitionByOutcome(rows);
    const renuevan = computeRenewalsWithinDays(billing, 7, now);
    const terminan = computeRenewalsWithinDays(completing, 7, now);
    const cancelaciones = computeRenewalsWithinDays(cancelling, 7, now);

    // Se recuenta sobre el FIXTURE, nunca sobre la salida de la partición:
    // contarlo sobre `[...billing, ...completing, ...cancelling]` volvía la
    // igualdad una tautología —duplicar una fila en dos baldes la satisfacía
    // igual— y dejaba todo el peso en el literal de abajo. `active` es la
    // condición que la consulta garantiza, así que es el filtro honesto.
    const vivasDentroDeVentana = rows.filter((r) => r.status === "active").filter((r) => {
      if (!r.current_period_end) return false;
      const end = new Date(r.current_period_end);
      return end >= now && end <= new Date(now.getTime() + 7 * 86_400_000);
    }).length;

    expect(renuevan.count + terminan.count + cancelaciones.count).toBe(vivasDentroDeVentana);
    // El literal también importa: fija el conteo esperado del fixture, así que
    // un cambio en la partición no puede "cuadrar" moviendo las dos cifras.
    expect(vivasDentroDeVentana).toBe(3);
  });

  it("el importe de 'Renuevan' sólo suma lo que de verdad se va a cobrar", () => {
    const { billing } = partitionByOutcome(rows);
    // De las tres que vencen dentro, sólo UNA vuelve a cobrar.
    expect(computeRenewalsWithinDays(billing, 7, now)).toEqual({ count: 1, amount: 999 });
  });
});
