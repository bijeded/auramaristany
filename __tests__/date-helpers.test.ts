import { describe, it, expect } from "vitest";
import { monthKey, monthLabel, dayLabel } from "@/lib/admin/date-helpers";

describe("monthKey", () => {
  it("devuelve YYYY-MM de un ISO date", () => {
    expect(monthKey("2026-06-10")).toBe("2026-06");
  });
});

describe("monthLabel", () => {
  it("formatea la llave de mes capitalizada en es-MX", () => {
    expect(monthLabel("2026-06")).toBe("Junio de 2026");
  });
});

describe("dayLabel", () => {
  it("formatea un ISO date a día corto capitalizado", () => {
    expect(dayLabel("2026-06-10")).toBe("10 jun 2026");
  });
});
