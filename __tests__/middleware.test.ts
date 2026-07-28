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

  it("redirects authenticated user with no role on protected route to login", () => {
    expect(getRedirectPath({
      pathname: "/onboarding/questionnaire",
      hasSession: true,
      role: null,
      onboardingCompleted: false,
      hasActiveSubscription: false,
    })).toBe("/auth/login");
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

  it("redirects logged-in admin away from /auth/login to dashboard", () => {
    expect(getRedirectPath({
      pathname: "/auth/login",
      hasSession: true,
      role: "admin",
      onboardingCompleted: true,
      hasActiveSubscription: false,
    })).toBe("/admin/dashboard");
  });

  it("redirects logged-in client away from /auth/register to portal", () => {
    expect(getRedirectPath({
      pathname: "/auth/register",
      hasSession: true,
      role: "client",
      onboardingCompleted: true,
      hasActiveSubscription: true,
    })).toBe("/portal/today");
  });

  it("does NOT redirect logged-in user on /auth/callback (email confirmation)", () => {
    expect(getRedirectPath({
      pathname: "/auth/callback",
      hasSession: true,
      role: "client",
      onboardingCompleted: true,
      hasActiveSubscription: true,
    })).toBeNull();
  });

  it("does NOT redirect logged-in user on /auth/reset-password", () => {
    expect(getRedirectPath({
      pathname: "/auth/reset-password",
      hasSession: true,
      role: "client",
      onboardingCompleted: true,
      hasActiveSubscription: true,
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

  it("allows access to /portal/activando without a subscription (payment processing page)", () => {
    expect(
      getRedirectPath({
        pathname: "/portal/activando",
        hasSession: true,
        role: "client",
        onboardingCompleted: false,
        hasActiveSubscription: false,
      })
    ).toBeNull();
  });
});

// L2c — portal graduado. Una cliente que TERMINÓ su programa conserva lo que
// ganó (su cuenta, sus pagos, su historial y sus fotos) y pierde lo que estaba
// pagando (contenido nuevo). Ni la echamos del portal ni le seguimos sirviendo
// entrenamientos.
describe("getRedirectPath — acceso graduado (status completed)", () => {
  const graduated = {
    hasSession: true,
    role: "client" as const,
    onboardingCompleted: true,
    hasActiveSubscription: false,
    hasGraduatedSubscription: true,
  };

  it.each([
    "/portal/settings",
    "/portal/history",
    "/portal/messages",
    "/portal/sin-suscripcion",
    "/portal/activando",
  ])("la deja entrar a %s", (pathname) => {
    expect(getRedirectPath({ ...graduated, pathname })).toBeNull();
  });

  it.each(["/portal/today", "/portal/semana", "/portal/pilares", "/portal/booking"])(
    "le niega el contenido de entrenamiento en %s y la lleva a su cuenta",
    (pathname) => {
      expect(getRedirectPath({ ...graduated, pathname })).toBe("/portal/settings");
    }
  );

  // La lista es de permitidos, no de prohibidos: una ruta de contenido nueva
  // nace cerrada para la graduada en vez de quedar abierta hasta que alguien
  // se acuerde de añadirla.
  it("una ruta de portal futura y desconocida queda cerrada por defecto", () => {
    expect(getRedirectPath({ ...graduated, pathname: "/portal/nueva-seccion" })).toBe(
      "/portal/settings"
    );
  });

  it("no la manda a /portal/sin-suscripcion: sí tiene una suscripción, terminada", () => {
    expect(getRedirectPath({ ...graduated, pathname: "/portal/today" })).not.toBe(
      "/portal/sin-suscripcion"
    );
  });

  it("no la reenvía al onboarding aunque no lo tenga marcado", () => {
    expect(
      getRedirectPath({
        ...graduated,
        onboardingCompleted: false,
        pathname: "/portal/settings",
      })
    ).toBeNull();
  });

  it("desde /onboarding la lleva a su cuenta, no al cuestionario", () => {
    expect(getRedirectPath({ ...graduated, pathname: "/onboarding/questionnaire" })).toBe(
      "/portal/settings"
    );
  });

  it("al re-loguearse aterriza en su cuenta, no en Hoy", () => {
    expect(getRedirectPath({ ...graduated, pathname: "/auth/login" })).toBe("/portal/settings");
  });

  it("sigue sin poder entrar al admin", () => {
    expect(getRedirectPath({ ...graduated, pathname: "/admin/clients" })).toBe("/portal/settings");
  });

  // Quien paga no cambia en nada: el nivel graduado sólo se aplica cuando NO
  // hay una suscripción que pague.
  it("quien paga no se ve afectada aunque arrastre una suscripción terminada", () => {
    expect(
      getRedirectPath({
        pathname: "/portal/today",
        hasSession: true,
        role: "client",
        onboardingCompleted: true,
        hasActiveSubscription: true,
        hasGraduatedSubscription: true,
      })
    ).toBeNull();
  });

  it("una cancelada (sin graduar) sigue yendo a /portal/sin-suscripcion", () => {
    expect(
      getRedirectPath({
        pathname: "/portal/today",
        hasSession: true,
        role: "client",
        onboardingCompleted: true,
        hasActiveSubscription: false,
        hasGraduatedSubscription: false,
      })
    ).toBe("/portal/sin-suscripcion");
  });
});
