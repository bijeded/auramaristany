import { describe, it, expect } from "vitest";
import { contrastRatio, compositeOverWhite } from "@/lib/ui/contrast";

// Pares de referencia de WCAG 2.x: si el helper se equivoca aquí, la prueba de
// contraste de las insignias aprobaría colores que no pasan.
describe("contrastRatio", () => {
  it("negro sobre blanco = 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });
  it("es simétrico", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });
  it("#767676 sobre blanco ≈ 4.54, el gris más claro que pasa 4.5:1", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
  it("acepta hex de tres dígitos", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
  });
});

describe("compositeOverWhite", () => {
  it("mezcla un rgba con el blanco de la tarjeta", () => {
    expect(compositeOverWhite("rgba(76,175,125,.14)")).toBe("#e6f4ed");
  });
  it("acepta espacios y alfa con cero inicial", () => {
    expect(compositeOverWhite("rgba(224, 92, 92, 0.10)")).toBe("#fcefef");
  });
  it("deja igual un hex opaco", () => {
    expect(compositeOverWhite("#EFEAFE")).toBe("#efeafe");
  });
  it("un color que no sabe leer lo rechaza con su nombre", () => {
    expect(() => compositeOverWhite("hsl(0 0% 50%)")).toThrow("hsl(0 0% 50%)");
  });
});
