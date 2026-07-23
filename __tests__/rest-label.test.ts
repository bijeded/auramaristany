import { describe, it, expect } from "vitest";
import { formatRestLabel } from "@/lib/content/rest-label";

// A2 — Rest in minutes: label-only formatting of rest_seconds
describe("formatRestLabel", () => {
  it("renders exact minutes as 'M min'", () => {
    // Arrange / Act / Assert
    expect(formatRestLabel(60)).toBe("1 min");
    expect(formatRestLabel(120)).toBe("2 min");
  });

  it("renders minute + seconds as 'M:SS min'", () => {
    expect(formatRestLabel(90)).toBe("1:30 min");
    expect(formatRestLabel(75)).toBe("1:15 min");
    expect(formatRestLabel(105)).toBe("1:45 min");
  });

  it("keeps values under a minute in seconds", () => {
    expect(formatRestLabel(45)).toBe("45 seg");
    expect(formatRestLabel(30)).toBe("30 seg");
  });

  it("pads seconds to two digits", () => {
    expect(formatRestLabel(65)).toBe("1:05 min");
  });

  it("handles zero as seconds", () => {
    expect(formatRestLabel(0)).toBe("0 seg");
  });
});
