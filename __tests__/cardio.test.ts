// __tests__/cardio.test.ts
import { describe, it, expect } from "vitest";
import { cardioZone2 } from "@/lib/content/cardio";

describe("cardioZone2", () => {
  it("computes floor and ceiling for age 50", () => {
    // (220-50)=170 → 170*0.6=102, 170*0.7=119
    expect(cardioZone2(50)).toEqual({ suelo: 102, cielo: 119 });
  });

  it("rounds to nearest integer for age 45", () => {
    // (220-45)=175 → 175*0.6=105, 175*0.7=122.5 → 123
    expect(cardioZone2(45)).toEqual({ suelo: 105, cielo: 123 });
  });

  it("returns nulls for non-finite input", () => {
    expect(cardioZone2(NaN)).toEqual({ suelo: null, cielo: null });
  });
});
