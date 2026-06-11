import { describe, it, expect } from "vitest";
import { subscriptionGrantsAccess, ACCESS_STATES } from "@/lib/content/subscription-access";

describe("subscriptionGrantsAccess", () => {
  it.each(["active", "trialing", "past_due"])("concede acceso a %s", (s) => {
    expect(subscriptionGrantsAccess(s)).toBe(true);
  });
  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", "desconocido"])(
    "niega acceso a %s",
    (s) => {
      expect(subscriptionGrantsAccess(s)).toBe(false);
    }
  );
  it("ACCESS_STATES es la fuente de verdad", () => {
    expect([...ACCESS_STATES]).toEqual(["active", "trialing", "past_due"]);
  });
});
