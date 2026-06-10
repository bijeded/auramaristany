import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const insertMock = vi.fn((_payload: Record<string, unknown>) => ({ error: null }));
const updateEqMock = vi.fn((_col: string, _val: string) => ({ error: null }));
const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: updateEqMock }));
const selectEqSingleMock = vi.fn(() => ({ data: null }));
const selectEqMock = vi.fn(() => ({ single: selectEqSingleMock }));
const selectMock = vi.fn(() => ({ eq: selectEqMock, single: selectEqSingleMock }));
const fromMock = vi.fn((_table: string) => ({ insert: insertMock, update: updateMock, select: selectMock }));

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
    insertMock.mockReturnValue({ error: null });
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

    expect(retrieveMock).toHaveBeenCalledWith("sub_123");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload.current_period_start).toBe(
      new Date(1749340800 * 1000).toISOString()
    );
    expect(payload.current_period_end).toBe(
      new Date(1751932800 * 1000).toISOString()
    );
  });
});

describe("handleInvoicePaid - subscription_create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReturnValue({ error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectEqSingleMock.mockReturnValue({ data: { id: "db-sub-1" }, error: null } as any);
  });

  it("registra el primer invoice con el subscription_id de la BD", async () => {
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

    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload.subscription_id).toBe("db-sub-1");
    expect(payload.stripe_invoice_id).toBe("in_first_123");
    expect(payload.amount_paid).toBe(990);
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
