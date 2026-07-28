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
