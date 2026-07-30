import { describe, it, expect } from "vitest";
import { formatSetsReps } from "@/lib/content/sets-reps-label";

// A14 — Target volume names its units: "4 series × 12 repeticiones".
// `sets` is a number; `reps` is free text authored by Aura, so the noun is
// appended only when the value is actually a repetition count.
describe("formatSetsReps", () => {
  it("names both units for a fixed repetition count", () => {
    // Arrange / Act / Assert
    expect(formatSetsReps(4, "12")).toBe("4 series × 12 repeticiones");
    expect(formatSetsReps(3, "8")).toBe("3 series × 8 repeticiones");
  });

  it("names both units for a range written with 'a'", () => {
    expect(formatSetsReps(4, "10 a 12")).toBe("4 series × 10 a 12 repeticiones");
  });

  it("recognizes a range written with a hyphen or an en dash", () => {
    expect(formatSetsReps(4, "10-12")).toBe("4 series × 10-12 repeticiones");
    expect(formatSetsReps(4, "10 – 12")).toBe("4 series × 10 – 12 repeticiones");
  });

  it("trims surrounding whitespace from the stored value", () => {
    expect(formatSetsReps(4, " 12 ")).toBe("4 series × 12 repeticiones");
    expect(formatSetsReps(4, "  10 a 12  ")).toBe("4 series × 10 a 12 repeticiones");
  });

  it("omits the noun when reps is not a repetition count", () => {
    // Aura's catalog holds only counts and ranges today; this is the guard that
    // keeps a future duration from reading "× 30 seg repeticiones".
    expect(formatSetsReps(4, "30 seg")).toBe("4 series × 30 seg");
    expect(formatSetsReps(4, "AMRAP")).toBe("4 series × AMRAP");
    expect(formatSetsReps(4, "12 por lado")).toBe("4 series × 12 por lado");
    expect(formatSetsReps(4, "máximas")).toBe("4 series × máximas");
  });

  it("drops the separator entirely when reps is empty", () => {
    expect(formatSetsReps(4, "")).toBe("4 series");
    expect(formatSetsReps(4, "   ")).toBe("4 series");
  });

  it("uses the multiplication sign, never a plain letter x", () => {
    expect(formatSetsReps(4, "12")).toContain("×");
    expect(formatSetsReps(4, "12")).not.toContain(" x ");
  });
});
