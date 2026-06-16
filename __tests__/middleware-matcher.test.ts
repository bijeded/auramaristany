// __tests__/middleware-matcher.test.ts
import { describe, it, expect } from "vitest";
import { config } from "@/middleware";

// Construye el RegExp a partir del patrón del matcher para probar cobertura.
function matches(pathname: string): boolean {
  const pattern = config.matcher[0]
    .replace(/^\//, "^/")        // ancla inicio
    .concat("$");                // ancla fin (el matcher de Next es full-path)
  return new RegExp(pattern).test(pathname);
}

describe("middleware matcher", () => {
  it("cubre rutas de portal", () => {
    expect(matches("/portal/today")).toBe(true);
  });
  it("cubre rutas de admin", () => {
    expect(matches("/admin/dashboard")).toBe(true);
  });
  it("excluye api/webhooks (Stripe, máquina-a-máquina)", () => {
    expect(matches("/api/webhooks/stripe")).toBe(false);
  });
  it("excluye api/cron (Vercel Cron)", () => {
    expect(matches("/api/cron/purge-messages")).toBe(false);
  });
  it("sigue cubriendo otras rutas api (p.ej. portal/progress)", () => {
    expect(matches("/api/portal/progress")).toBe(true);
  });
});
