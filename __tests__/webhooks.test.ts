import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
// insert ahora soporta el encadenado .select("id").single() (handleCheckoutCompleted
// necesita el id de la sub recién creada para registrar su primer invoice).
const insertSingleMock = vi.fn(() => ({ data: { id: "db-sub-new" }, error: null }));
const insertMock = vi.fn((_payload: Record<string, unknown>) => ({
  select: () => ({ single: insertSingleMock }),
}));
const upsertMock = vi.fn((_payload: Record<string, unknown>, _opts?: Record<string, unknown>) => ({ error: null }));
const updateEqMock = vi.fn((_col: string, _val: string) => ({ error: null }));
const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: updateEqMock }));
const selectEqSingleMock = vi.fn(() => ({ data: null }));
const selectEqMock = vi.fn(() => ({ single: selectEqSingleMock }));
const selectMock = vi.fn(() => ({ eq: selectEqMock, single: selectEqSingleMock }));
const fromMock = vi.fn((_table: string) => ({ insert: insertMock, upsert: upsertMock, update: updateMock, select: selectMock }));

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

describe("handleSubscriptionUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateEqMock.mockReturnValue({ error: null });
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
