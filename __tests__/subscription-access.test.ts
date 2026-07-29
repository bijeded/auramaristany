import { describe, it, expect } from "vitest";
import {
  subscriptionGrantsAccess,
  subscriptionGrantsPortalShell,
  subscriptionIsGraduated,
  derivePortalTier,
  ACCESS_STATES,
  GRADUATED_STATES,
  PORTAL_SHELL_STATES,
} from "@/lib/content/subscription-access";

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

  // L2c — la comprobación estricta NO se ensancha. Todo camino que sirve
  // contenido de entrenamiento pasa por aquí, así que meter `completed` en
  // ACCESS_STATES le daría contenido nuevo a quien ya no paga, por nueve
  // llamadores a la vez.
  it("niega acceso a completed: terminar el programa no da contenido nuevo", () => {
    expect(subscriptionGrantsAccess("completed")).toBe(false);
  });
  it("completed NO está en ACCESS_STATES", () => {
    expect([...ACCESS_STATES]).not.toContain("completed");
  });
});

describe("subscriptionGrantsPortalShell", () => {
  it.each(["active", "trialing", "past_due"])("quien paga sigue entrando: %s", (s) => {
    expect(subscriptionGrantsPortalShell(s)).toBe(true);
  });
  it("quien terminó entra al portal (sus datos son suyos)", () => {
    expect(subscriptionGrantsPortalShell("completed")).toBe(true);
  });
  it.each(["canceled", "unpaid", "desconocido"])("niega la cáscara a %s", (s) => {
    expect(subscriptionGrantsPortalShell(s)).toBe(false);
  });
  it("PORTAL_SHELL_STATES = ACCESS_STATES + los graduados", () => {
    expect([...PORTAL_SHELL_STATES]).toEqual([...ACCESS_STATES, ...GRADUATED_STATES]);
  });
});

describe("subscriptionIsGraduated", () => {
  it("sólo completed está graduada", () => {
    expect(subscriptionIsGraduated("completed")).toBe(true);
  });
  it.each(["active", "trialing", "past_due", "canceled", "unpaid"])("no lo está: %s", (s) => {
    expect(subscriptionIsGraduated(s)).toBe(false);
  });
});

describe("derivePortalTier", () => {
  it("sin suscripciones no hay nivel", () => {
    expect(derivePortalTier([])).toBe("none");
  });
  it("una suscripción que paga da el nivel completo", () => {
    expect(derivePortalTier(["active"])).toBe("paying");
  });
  it("sólo una terminada da el nivel graduado", () => {
    expect(derivePortalTier(["completed"])).toBe("graduated");
  });
  it("cancelada o impaga no da nada", () => {
    expect(derivePortalTier(["canceled", "unpaid"])).toBe("none");
  });

  // El caso que este helper existe para resolver: terminó CuarentaMás y compró
  // Extra. Las DOS filas viven a la vez, y quedarse con la graduada la dejaría
  // sin el contenido que acaba de pagar.
  it("pagar gana a haber terminado, en cualquier orden", () => {
    expect(derivePortalTier(["completed", "active"])).toBe("paying");
    expect(derivePortalTier(["active", "completed"])).toBe("paying");
  });
  it("una terminada junto a una cancelada sigue siendo graduada", () => {
    expect(derivePortalTier(["canceled", "completed"])).toBe("graduated");
  });
});
