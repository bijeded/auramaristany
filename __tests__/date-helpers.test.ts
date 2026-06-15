import { describe, it, expect } from "vitest";
import { monthKey, monthLabel, dayLabel, weekdayLabel, longDateLabel } from "@/lib/admin/date-helpers";

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
  it("tolera iso con tiempo (timestamptz)", () => {
    expect(dayLabel("2026-06-08T04:00:00+00:00")).toBe("8 jun 2026");
  });
});

describe("weekdayLabel", () => {
  it("formatea weekday + día + mes, capitalizado, sin año", () => {
    expect(weekdayLabel("2026-06-08")).toBe("Lunes, 8 de junio");
  });
  it("default a hoy cuando no recibe iso (no truena)", () => {
    expect(typeof weekdayLabel()).toBe("string");
  });
});

describe("longDateLabel", () => {
  it("formatea día + mes largo + año", () => {
    expect(longDateLabel("2026-06-08")).toBe("8 de junio de 2026");
  });
  it("tolera iso con tiempo (toma la parte de fecha)", () => {
    expect(longDateLabel("2026-06-08T00:00:00Z")).toBe("8 de junio de 2026");
  });
});
