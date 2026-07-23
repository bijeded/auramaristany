import { describe, it, expect } from "vitest";
import { lbToKg, kgToLb } from "@/lib/content/weight-units";

// A1 — kg/lb entry + display conversion (storage is always canonical kg)
describe("lbToKg", () => {
  it("converts common plate values with 1-decimal rounding", () => {
    expect(lbToKg(55)).toBe(24.9);
    expect(lbToKg(45)).toBe(20.4);
    expect(lbToKg(25)).toBe(11.3);
    expect(lbToKg(10)).toBe(4.5);
  });

  it("handles zero", () => {
    expect(lbToKg(0)).toBe(0);
  });
});

describe("kgToLb", () => {
  it("converts with 1-decimal rounding", () => {
    expect(kgToLb(24.9)).toBe(54.9);
    expect(kgToLb(20)).toBe(44.1);
    expect(kgToLb(0)).toBe(0);
  });
});

describe("round-trip stability", () => {
  it("kg → lb → kg returns the original 1-decimal kg value", () => {
    for (const kg of [24.9, 20.4, 11.3, 4.5, 60, 2.5]) {
      expect(lbToKg(kgToLb(kg))).toBe(kg);
    }
  });
});
