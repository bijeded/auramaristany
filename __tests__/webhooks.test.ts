import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
// insert ahora soporta el encadenado .select("id").single() (handleCheckoutCompleted
// necesita el id de la sub recién creada para registrar su primer invoice).
const insertSingleMock = vi.fn(() => ({ data: { id: "db-sub-new" }, error: null }));
const insertMock = vi.fn((_payload: Record<string, unknown>) => ({
  select: () => ({ single: insertSingleMock }),
}));
// upsert(...).select("id") devuelve las filas REALMENTE insertadas: con
// ignoreDuplicates, un conflicto devuelve []. Es lo que distingue una factura
// nueva de una redelivery de Stripe, y lo que decide si se avanza o no.
const upsertInsertedRows = vi.fn((): { data: unknown[] | null; error: unknown } => ({
  data: [{ id: "inv-new" }],
  error: null,
}));
const upsertMock = vi.fn((_payload: Record<string, unknown>, _opts?: Record<string, unknown>) => ({
  error: null,
  select: () => upsertInsertedRows(),
}));
// update().eq() is awaited directly ({ error }) by most handlers, and also chained
// .select().maybeSingle() by handleSubscriptionDeleted (needs the deleted row's ids).
const deletedRowMaybeSingle = vi.fn((): { data: unknown; error: unknown } => ({ data: null, error: null }));
// update().eq() se encadena hasta tres veces (id + guarda optimista sobre
// months_elapsed y content_ordinal) y termina en .select() o .maybeSingle().
const updatedRows = vi.fn((): { data: unknown[]; error: unknown } => ({
  data: [{ id: "db-sub-1" }],
  error: null,
}));
const updateEqChain: Record<string, unknown> = {};
Object.assign(updateEqChain, {
  error: null,
  eq: () => updateEqChain,
  select: () => updatedRows(),
  maybeSingle: deletedRowMaybeSingle,
});
const updateEqMock = vi.fn((_col: string, _val: string) => ({
  error: null,
  eq: () => updateEqChain,
  select: () => ({ maybeSingle: deletedRowMaybeSingle }),
}));
const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: updateEqMock }));
const selectEqSingleMock = vi.fn(() => ({ data: null }));
// Chainable select: any number of .eq(), terminating in .single() or .maybeSingle().
const selectMaybeSingleMock = vi.fn((): { data: unknown } => ({ data: null }));
const selectChain: {
  eq: () => typeof selectChain;
  single: typeof selectEqSingleMock;
  maybeSingle: typeof selectMaybeSingleMock;
} = {
  eq: () => selectChain,
  single: selectEqSingleMock,
  maybeSingle: selectMaybeSingleMock,
};
const selectMock = vi.fn(() => selectChain);

// Currículo y escalera: los lee el avance del puntero de contenido. Se sirven
// por tabla porque el avance necesita el mapeo de DOS variantes (el peldaño
// actual y el siguiente) y el `ladder_next_variant_id` del actual.
const curriculumRows = vi.fn((): { data: unknown[]; error: unknown } => ({
  data: [
    { program_variant_id: "variant-1", series_id: "s1", ordinal: 1 },
    { program_variant_id: "variant-1", series_id: "s2", ordinal: 2 },
    { program_variant_id: "variant-1", series_id: "s3", ordinal: 3 },
  ],
  error: null,
}));
const ladderRow = vi.fn((): { data: unknown; error: unknown } => ({
  data: { id: "variant-1", ladder_next_variant_id: null },
  error: null,
}));

const fromMock = vi.fn((table: string) => {
  if (table === "variant_series_map") {
    return {
      insert: insertMock,
      upsert: upsertMock,
      update: updateMock,
      select: () => ({
        in: () => curriculumRows(),
        eq: () => curriculumRows(),
      }),
    };
  }
  if (table === "program_variants") {
    return {
      insert: insertMock,
      upsert: upsertMock,
      update: updateMock,
      select: () => ({ eq: () => ({ single: () => ladderRow() }) }),
    };
  }
  return { insert: insertMock, upsert: upsertMock, update: updateMock, select: selectMock };
});

vi.mock("@/lib/email/send", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendSubscriptionEndedEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: fromMock }),
}));

const retrieveMock = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: { subscriptions: { retrieve: (...args: unknown[]) => retrieveMock(...args) } },
}));

import {
  computeMonthsUpdate,
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleInvoicePaid,
  handleSubscriptionDeleted,
} from "@/lib/webhooks/stripe-handlers";
import type Stripe from "stripe";

describe("computeMonthsUpdate", () => {
  it("increments months_elapsed by 1", () => {
    const result = computeMonthsUpdate(1, "rolling_monthly", null);
    expect(result.newMonthsElapsed).toBe(2);
    expect(result.shouldComplete).toBe(false);
  });

  it("sets shouldComplete when fixed_term program reaches duration", () => {
    const result = computeMonthsUpdate(5, "fixed_term_monthly", 6);
    expect(result.newMonthsElapsed).toBe(6);
    expect(result.shouldComplete).toBe(true);
  });

  it("does not set shouldComplete for rolling programs", () => {
    const result = computeMonthsUpdate(10, "rolling_monthly", null);
    expect(result.shouldComplete).toBe(false);
  });

  it("does not set shouldComplete before reaching duration", () => {
    const result = computeMonthsUpdate(4, "fixed_term_monthly", 6);
    expect(result.shouldComplete).toBe(false);
  });

  it("does not set shouldComplete when duration is null", () => {
    const result = computeMonthsUpdate(5, "fixed_term_monthly", null);
    expect(result.shouldComplete).toBe(false);
  });
});

describe("handleCheckoutCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retrieveMock.mockResolvedValue({
      items: {
        data: [{ current_period_start: 1749340800, current_period_end: 1751932800 }],
      },
    });
  });

  it("inserts current_period_start/end as ISO strings sourced from subscription items", async () => {
    const session = {
      id: "cs_test_123",
      metadata: { supabase_user_id: "user-1", variant_id: "variant-1" },
      subscription: "sub_123",
      customer: "cus_123",
    } as unknown as Stripe.Checkout.Session;

    await handleCheckoutCompleted(session);

    expect(retrieveMock).toHaveBeenCalledWith("sub_123", { expand: ["latest_invoice"] });
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload.current_period_start).toBe(
      new Date(1749340800 * 1000).toISOString()
    );
    expect(payload.current_period_end).toBe(
      new Date(1751932800 * 1000).toISOString()
    );
  });

  it("registra el primer invoice desde latest_invoice (no depende de invoice.paid) — G4", async () => {
    retrieveMock.mockResolvedValue({
      items: { data: [{ current_period_start: 1749340800, current_period_end: 1751932800 }] },
      latest_invoice: {
        id: "in_first_xyz",
        amount_paid: 99900,
        currency: "mxn",
        status: "paid",
        created: 1749340800,
      },
    });
    const session = {
      id: "cs_test_456",
      metadata: { supabase_user_id: "user-2", variant_id: "variant-2" },
      subscription: "sub_456",
      customer: "cus_456",
    } as unknown as Stripe.Checkout.Session;

    await handleCheckoutCompleted(session);

    // La sub se inserta y SU primer invoice se registra en el mismo evento.
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const inv = upsertMock.mock.calls[0][0];
    expect(inv.subscription_id).toBe("db-sub-new");
    expect(inv.stripe_invoice_id).toBe("in_first_xyz");
    expect(inv.amount_paid).toBe(999);
    // Idempotente: no duplica si invoice.paid también lo intenta.
    expect(upsertMock.mock.calls[0][1]).toEqual({
      onConflict: "stripe_invoice_id",
      ignoreDuplicates: true,
    });
  });

  it("no registra invoice si latest_invoice no está pagado", async () => {
    retrieveMock.mockResolvedValue({
      items: { data: [{ current_period_start: 1749340800, current_period_end: 1751932800 }] },
      latest_invoice: { id: "in_open", amount_paid: 0, currency: "mxn", status: "open", created: 1749340800 },
    });
    const session = {
      id: "cs_test_789",
      metadata: { supabase_user_id: "user-3", variant_id: "variant-3" },
      subscription: "sub_789",
      customer: "cus_789",
    } as unknown as Stripe.Checkout.Session;

    await handleCheckoutCompleted(session);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("lanza el error si stripe.subscriptions.retrieve falla para que Stripe reintente (D2)", async () => {
    retrieveMock.mockRejectedValue(new Error("Network error"));
    const session = {
      id: "cs_test_err",
      metadata: { supabase_user_id: "user-err", variant_id: "variant-err" },
      subscription: "sub_err",
      customer: "cus_err",
    } as unknown as Stripe.Checkout.Session;

    await expect(handleCheckoutCompleted(session)).rejects.toThrow("Network error");
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("handleInvoicePaid - subscription_create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectEqSingleMock.mockReturnValue({ data: { id: "db-sub-1" }, error: null } as any);
  });

  it("registra (upsert idempotente) el primer invoice con el subscription_id de la BD — red de seguridad", async () => {
    const invoice = {
      id: "in_first_123",
      billing_reason: "subscription_create",
      amount_paid: 99000,
      currency: "mxn",
      status: "paid",
      created: 1749340800,
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: "sub_123" },
      },
    } as unknown as Stripe.Invoice;

    await handleInvoicePaid(invoice);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload.subscription_id).toBe("db-sub-1");
    expect(payload.stripe_invoice_id).toBe("in_first_123");
    expect(payload.amount_paid).toBe(990);
    expect(upsertMock.mock.calls[0][1]).toEqual({
      onConflict: "stripe_invoice_id",
      ignoreDuplicates: true,
    });
  });
});

describe("handleInvoicePaid — idempotencia y avance del puntero", () => {
  function renewalInvoice(id = "in_renewal_1"): Stripe.Invoice {
    return {
      id,
      billing_reason: "subscription_cycle",
      amount_paid: 99000,
      currency: "mxn",
      status: "paid",
      created: 1749340800,
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: "sub_123" },
      },
    } as unknown as Stripe.Invoice;
  }

  /** La fila de la suscripción tal como la lee el handler, con su puntero. */
  function subRow(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        id: "db-sub-1",
        months_elapsed: 2,
        content_variant_id: "variant-1",
        content_ordinal: 2,
        content_loops: 0,
        program_variant_id: "variant-1",
        program_variants: {
          programs: { billing_model: "rolling_monthly", duration_months: null },
        },
        ...overrides,
      },
      error: null,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    updateEqMock.mockImplementation((_col: string, _val: string) => ({
      error: null,
      eq: () => updateEqChain,
      select: () => ({ maybeSingle: deletedRowMaybeSingle }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectEqSingleMock.mockReturnValue(subRow() as any);
    upsertInsertedRows.mockReturnValue({ data: [{ id: "inv-new" }], error: null });
    updatedRows.mockReturnValue({ data: [{ id: "db-sub-1" }], error: null });
    curriculumRows.mockReturnValue({
      data: [
        { program_variant_id: "variant-1", series_id: "s1", ordinal: 1 },
        { program_variant_id: "variant-1", series_id: "s2", ordinal: 2 },
        { program_variant_id: "variant-1", series_id: "s3", ordinal: 3 },
      ],
      error: null,
    });
    ladderRow.mockReturnValue({
      data: { id: "variant-1", ladder_next_variant_id: null },
      error: null,
    });
  });

  it("una factura nueva avanza el mes Y el puntero, en una sola escritura", async () => {
    await handleInvoicePaid(renewalInvoice());

    expect(updateMock).toHaveBeenCalledTimes(1);
    const payload = updateMock.mock.calls[0][0];
    expect(payload.months_elapsed).toBe(3);
    expect(payload.content_variant_id).toBe("variant-1");
    expect(payload.content_ordinal).toBe(3);
    expect(payload.content_loops).toBe(0);
  });

  it("una redelivery NO avanza nada", async () => {
    // Stripe reentrega invoice.paid en reintentos y replays. Con el upsert
    // idempotente el invoice no se duplica, pero hasta ahora el incremento de
    // `months_elapsed` no estaba protegido: la cliente sumaba dos meses. Con el
    // puntero encima, una redelivery le SALTARÍA un mes de entrenamiento sin
    // dejar rastro.
    upsertInsertedRows.mockReturnValue({ data: [], error: null });

    await handleInvoicePaid(renewalInvoice());

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("al agotar el peldaño pasa al siguiente en su primera posición", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectEqSingleMock.mockReturnValue(subRow({ content_ordinal: 3 }) as any);
    ladderRow.mockReturnValue({
      data: { id: "variant-1", ladder_next_variant_id: "variant-2" },
      error: null,
    });
    curriculumRows.mockReturnValue({
      data: [
        { program_variant_id: "variant-1", series_id: "s3", ordinal: 3 },
        { program_variant_id: "variant-2", series_id: "t1", ordinal: 1 },
        { program_variant_id: "variant-2", series_id: "t2", ordinal: 2 },
      ],
      error: null,
    });

    await handleInvoicePaid(renewalInvoice());

    const payload = updateMock.mock.calls[0][0];
    expect(payload.content_variant_id).toBe("variant-2");
    expect(payload.content_ordinal).toBe(1);
  });

  it("en el último peldaño da la vuelta y cuenta la vuelta", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectEqSingleMock.mockReturnValue(subRow({ content_ordinal: 3 }) as any);

    await handleInvoicePaid(renewalInvoice());

    const payload = updateMock.mock.calls[0][0];
    expect(payload.content_ordinal).toBe(1);
    expect(payload.content_loops).toBe(1);
  });

  it("una suscripción de plazo fijo cumplida congela el puntero", async () => {
    selectEqSingleMock.mockReturnValue(
      subRow({
        months_elapsed: 6,
        content_ordinal: 3,
        program_variants: {
          programs: { billing_model: "fixed_term_monthly", duration_months: 6 },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
    );

    await handleInvoicePaid(renewalInvoice());

    const payload = updateMock.mock.calls[0][0];
    expect(payload.content_ordinal).toBe(3);
    expect(payload.content_loops).toBe(0);
    expect(payload.content_variant_id).toBe("variant-1");
  });

  it("de plazo fijo, el mes ANTERIOR al último todavía avanza", async () => {
    // Complementario del test de congelación, y el que fija la convención de
    // `monthsElapsed`: si se pasara el valor ya incrementado, esta cliente se
    // congelaría en la posición 5 y no vería nunca el sexto y último mes que
    // pagó. Con `months_elapsed: 5` y duración 6 TIENE que avanzar a la 6.
    selectEqSingleMock.mockReturnValue(
      subRow({
        months_elapsed: 5,
        content_ordinal: 2,
        program_variants: {
          programs: { billing_model: "fixed_term_monthly", duration_months: 6 },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
    );

    await handleInvoicePaid(renewalInvoice());

    const payload = updateMock.mock.calls[0][0];
    expect(payload.months_elapsed).toBe(6);
    expect(payload.content_ordinal).toBe(3);
  });

  it("relanza si otra escritura concurrente se adelantó (no pierde el avance)", async () => {
    // La guarda optimista no encuentra fila: alguien ya movió el puntero. Se
    // relanza para que Stripe reintente en vez de dar el mes por avanzado.
    updatedRows.mockReturnValue({ data: [], error: null });

    await expect(handleInvoicePaid(renewalInvoice())).rejects.toThrow();
  });

  it("relanza si falla el registro de la factura, para que Stripe reintente", async () => {
    // Tragarse el error y responder 200 convertiría un fallo transitorio de la
    // base en un mes de entrenamiento perdido para siempre: Stripe no reintenta.
    upsertInsertedRows.mockReturnValue({ data: null, error: { message: "boom" } });

    await expect(handleInvoicePaid(renewalInvoice())).rejects.toThrow();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("no escribe `program_variant_id`: lo que compró no se reescribe nunca", async () => {
    await handleInvoicePaid(renewalInvoice());

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty("program_variant_id");
  });
});

describe("handleCheckoutCompleted — inicialización del puntero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retrieveMock.mockResolvedValue({
      items: { data: [{ current_period_start: 1749340800, current_period_end: 1751932800 }] },
    });
    curriculumRows.mockReturnValue({
      data: [
        { program_variant_id: "variant-1", series_id: "s4", ordinal: 4 },
        { program_variant_id: "variant-1", series_id: "s5", ordinal: 5 },
      ],
      error: null,
    });
  });

  function session(): Stripe.Checkout.Session {
    return {
      id: "cs_ptr",
      metadata: { supabase_user_id: "user-p", variant_id: "variant-1" },
      subscription: "sub_ptr",
      customer: "cus_ptr",
    } as unknown as Stripe.Checkout.Session;
  }

  it("arranca en la variante comprada y en su primera posición EXISTENTE", async () => {
    // Entrar directo a cualquier nivel es el caso normal: Aura evalúa fuera de
    // la plataforma y manda a la cliente al peldaño que le toca. Y la primera
    // posición no es un 1 fijo: es la más baja que existe en el currículo.
    await handleCheckoutCompleted(session());

    const payload = insertMock.mock.calls[0][0];
    expect(payload.content_variant_id).toBe("variant-1");
    expect(payload.content_ordinal).toBe(4);
    expect(payload.content_loops).toBe(0);
  });
});

describe("handleSubscriptionUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateEqMock.mockReturnValue({ error: null, eq: () => updateEqChain, select: () => ({ maybeSingle: deletedRowMaybeSingle }) });
  });

  it("updates current_period_start/end as ISO strings from subscription items", async () => {
    const subscription = {
      id: "sub_123",
      status: "active",
      cancel_at_period_end: false,
      items: {
        data: [{ current_period_start: 1749340800, current_period_end: 1751932800 }],
      },
    } as unknown as Stripe.Subscription;

    await handleSubscriptionUpdated(subscription);

    expect(updateMock).toHaveBeenCalledTimes(1);
    const payload = updateMock.mock.calls[0][0];
    expect(payload.current_period_start).toBe(
      new Date(1749340800 * 1000).toISOString()
    );
    expect(payload.current_period_end).toBe(
      new Date(1751932800 * 1000).toISOString()
    );
  });
});

describe("handleSubscriptionDeleted (A9 — involuntary logging)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A prior describe pins updateEqMock via mockReturnValue; restore the chain here.
    updateEqMock.mockImplementation((_col: string, _val: string) => ({
      error: null,
      eq: () => updateEqChain,
      select: () => ({ maybeSingle: deletedRowMaybeSingle }),
    }));
    deletedRowMaybeSingle.mockReturnValue({ data: { id: "db-sub-1", profile_id: "p-1" }, error: null });
    // No pre-existing involuntary row by default (idempotency guard lookup).
    selectMaybeSingleMock.mockReturnValue({ data: null });
  });

  function deletedEvent(reason: string | null): Stripe.Subscription {
    return {
      id: "sub_stripe_1",
      cancellation_details: reason ? { reason } : null,
    } as unknown as Stripe.Subscription;
  }

  it("inserts a pago_fallido row on payment_failed", async () => {
    await handleSubscriptionDeleted(deletedEvent("payment_failed"));
    expect(fromMock).toHaveBeenCalledWith("cancellation_surveys");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: "p-1", subscription_id: "db-sub-1", reason: "pago_fallido", source: "involuntary" })
    );
  });

  it("inserts a pago_fallido row on payment_disputed", async () => {
    await handleSubscriptionDeleted(deletedEvent("payment_disputed"));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "pago_fallido", source: "involuntary" })
    );
  });

  it("does NOT insert a survey row on cancellation_requested (voluntary already logged)", async () => {
    await handleSubscriptionDeleted(deletedEvent("cancellation_requested"));
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("does NOT insert when there is no cancellation reason", async () => {
    await handleSubscriptionDeleted(deletedEvent(null));
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("is idempotent: does NOT insert a second pago_fallido row on redelivery", async () => {
    selectMaybeSingleMock.mockReturnValue({ data: { id: "existing-row" } });
    await handleSubscriptionDeleted(deletedEvent("payment_failed"));
    expect(insertMock).not.toHaveBeenCalled();
  });
});
