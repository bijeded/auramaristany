import { describe, it, expect } from "vitest";
import { extraCheckoutSlugForLevel, EXTRA_ENTRY_VARIANT_SLUG } from "@/lib/portal/graduation";

// L2c — el CTA de "sigue con CuarentaMás Extra" tiene que llevarla al peldaño
// que le toca. Extra sólo tiene dos: intermedio y avanzado.
describe("extraCheckoutSlugForLevel", () => {
  it("quien terminó en avanzado sigue en Extra Avanzado", () => {
    expect(extraCheckoutSlugForLevel("avanzado")).toBe("cuarenta-mas-extra-avanzado");
  });

  it("quien terminó en intermedio sigue en Extra Intermedio", () => {
    expect(extraCheckoutSlugForLevel("intermedio")).toBe("cuarenta-mas-extra-intermedio");
  });

  // Principiante no tiene equivalente en Extra: entra por el peldaño más bajo
  // que Extra ofrece. Mandarla a Avanzado sería un problema de seguridad, no de
  // producto —es fuerza para mujeres de 40+—, así que la caída es hacia abajo.
  it("quien terminó en principiante entra por el peldaño más bajo de Extra", () => {
    expect(extraCheckoutSlugForLevel("principiante")).toBe("cuarenta-mas-extra-intermedio");
  });

  it("sin nivel conocido cae al peldaño de entrada, nunca al avanzado", () => {
    expect(extraCheckoutSlugForLevel(null)).toBe(EXTRA_ENTRY_VARIANT_SLUG);
    expect(extraCheckoutSlugForLevel("")).toBe(EXTRA_ENTRY_VARIANT_SLUG);
    expect(extraCheckoutSlugForLevel("nivel-que-no-existe")).toBe(EXTRA_ENTRY_VARIANT_SLUG);
    expect(EXTRA_ENTRY_VARIANT_SLUG).toBe("cuarenta-mas-extra-intermedio");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// El CTA cuelga de dos slugs literales. Un rename en el seed los rompería con
// TODAS las pruebas en verde, porque aquí no hay nada que consulte el catálogo.
describe("los slugs del CTA existen en el catálogo sembrado", () => {
  // Vitest corre con la raíz del proyecto como cwd (vitest.config.ts), que es
  // lo que ancla esta ruta.
  const seed = readFileSync(
    resolve(process.cwd(), "supabase/migrations/002_seed_programs_variants.sql"),
    "utf8"
  );

  it.each(["cuarenta-mas-extra-intermedio", "cuarenta-mas-extra-avanzado"])(
    "%s está sembrado",
    (slug) => {
      expect(seed).toContain(slug);
    }
  );
});
