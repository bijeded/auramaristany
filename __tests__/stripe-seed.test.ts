import { describe, it, expect } from "vitest";
import { STRIPE_BACKED, stripeSeedParams, isSeedCustomer } from "../scripts/stripe-seed";

const TODAY = new Date("2026-09-21T12:00:00Z");
const periodStart = new Date("2026-09-09T12:00:00Z");
const periodEnd = new Date("2026-10-09T12:00:00Z");
const toUnix = (d: Date) => Math.floor(d.getTime() / 1000);

describe("stripeSeedParams", () => {
  it("returns null for a client outside the Stripe-backed set", () => {
    // Arrange
    const email = "sofia.ramirez@test.aura.mx";

    // Act
    const params = stripeSeedParams({ email, periodStart, periodEnd, today: TODAY });

    // Assert
    expect(params).toBeNull();
  });

  it("backdates the subscription to exactly the seed's period, without billing it", () => {
    // Arrange
    const email = "gaby.torres@test.aura.mx";

    // Act
    const params = stripeSeedParams({ email, periodStart, periodEnd, today: TODAY });

    // Assert
    expect(params).toEqual({
      backdateStartDate: toUnix(periodStart),
      billingCycleAnchor: toUnix(periodEnd),
      cancelAtPeriodEnd: false,
      flow: "cancel",
    });
  });

  it("schedules the cancellation for the grace client", () => {
    // Arrange
    const email = "adri.ortega@test.aura.mx";

    // Act
    const params = stripeSeedParams({ email, periodStart, periodEnd, today: TODAY });

    // Assert
    expect(params?.cancelAtPeriodEnd).toBe(true);
    expect(params?.flow).toBe("reactivate");
  });

  it("rejects a period that does not start strictly before today (rule 17)", () => {
    // Arrange
    const email = "gaby.torres@test.aura.mx";

    // Act
    const act = () => stripeSeedParams({ email, periodStart: TODAY, periodEnd, today: TODAY });

    // Assert
    expect(act).toThrow();
  });

  it("covers at least two cancellable clients and one reactivatable client", () => {
    // Arrange
    const flows = Object.values(STRIPE_BACKED);

    // Act
    const cancel = flows.filter((f) => f === "cancel").length;
    const reactivate = flows.filter((f) => f === "reactivate").length;

    // Assert
    expect(cancel).toBeGreaterThanOrEqual(2);
    expect(reactivate).toBeGreaterThanOrEqual(1);
  });
});

describe("isSeedCustomer", () => {
  it("matches only customers the seed tagged", () => {
    // Arrange
    const tagged = { metadata: { seed: "demo" } };
    const checkout = { metadata: { supabase_user_id: "x" } };
    const probe = { metadata: { seed: "probe" } };

    // Act / Assert
    expect(isSeedCustomer(tagged)).toBe(true);
    expect(isSeedCustomer(checkout)).toBe(false);
    expect(isSeedCustomer(probe)).toBe(false);
  });
});
