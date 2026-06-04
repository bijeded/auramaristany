import { describe, it, expect } from "vitest";
import { getRedirectPath } from "@/lib/middleware-utils";

describe("getRedirectPath", () => {
  it("redirects to login when no session on protected route", () => {
    expect(getRedirectPath({
      pathname: "/portal/today",
      hasSession: false,
      role: null,
      onboardingCompleted: false,
      hasActiveSubscription: false,
    })).toBe("/auth/login");
  });

  it("redirects to login when no session on admin route", () => {
    expect(getRedirectPath({
      pathname: "/admin/dashboard",
      hasSession: false,
      role: null,
      onboardingCompleted: false,
      hasActiveSubscription: false,
    })).toBe("/auth/login");
  });

  it("redirects admin visiting /portal to /admin/dashboard", () => {
    expect(getRedirectPath({
      pathname: "/portal/today",
      hasSession: true,
      role: "admin",
      onboardingCompleted: true,
      hasActiveSubscription: false,
    })).toBe("/admin/dashboard");
  });

  it("redirects client visiting /admin to /portal/today", () => {
    expect(getRedirectPath({
      pathname: "/admin/clients",
      hasSession: true,
      role: "client",
      onboardingCompleted: true,
      hasActiveSubscription: true,
    })).toBe("/portal/today");
  });

  it("redirects to onboarding when subscription active but onboarding not completed", () => {
    expect(getRedirectPath({
      pathname: "/portal/today",
      hasSession: true,
      role: "client",
      onboardingCompleted: false,
      hasActiveSubscription: true,
    })).toBe("/onboarding/questionnaire");
  });

  it("allows access when session, subscription, and onboarding all complete", () => {
    expect(getRedirectPath({
      pathname: "/portal/today",
      hasSession: true,
      role: "client",
      onboardingCompleted: true,
      hasActiveSubscription: true,
    })).toBeNull();
  });

  it("allows access to public auth routes without session", () => {
    expect(getRedirectPath({
      pathname: "/auth/login",
      hasSession: false,
      role: null,
      onboardingCompleted: false,
      hasActiveSubscription: false,
    })).toBeNull();
  });

  it("allows access to checkout routes without session", () => {
    expect(getRedirectPath({
      pathname: "/checkout/cuarenta-mas-principiante-poco",
      hasSession: false,
      role: null,
      onboardingCompleted: false,
      hasActiveSubscription: false,
    })).toBeNull();
  });

  it("redirects client with no subscription on /portal to /portal/sin-suscripcion", () => {
    expect(
      getRedirectPath({
        pathname: "/portal/today",
        hasSession: true,
        role: "client",
        onboardingCompleted: false,
        hasActiveSubscription: false,
      })
    ).toBe("/portal/sin-suscripcion");
  });

  it("redirects client with no subscription on /onboarding to /portal/sin-suscripcion", () => {
    expect(
      getRedirectPath({
        pathname: "/onboarding/questionnaire",
        hasSession: true,
        role: "client",
        onboardingCompleted: false,
        hasActiveSubscription: false,
      })
    ).toBe("/portal/sin-suscripcion");
  });

  it("allows access to /portal/sin-suscripcion even without a subscription (no redirect loop)", () => {
    expect(
      getRedirectPath({
        pathname: "/portal/sin-suscripcion",
        hasSession: true,
        role: "client",
        onboardingCompleted: false,
        hasActiveSubscription: false,
      })
    ).toBeNull();
  });
});
