import { describe, it, expect } from "vitest";
import { monthKey, monthLabel, dayLabel, weekdayLabel, longDateLabel, relativeDayLabel } from "@/lib/admin/date-helpers";

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

describe("relativeDayLabel", () => {
  const NOW = "2026-07-15";

  it("el mismo día es 'hoy'", () => {
    expect(relativeDayLabel("2026-07-15", NOW)).toBe("hoy");
  });

  // El caso que justifica que esto sea un helper con pruebas y no un template
  // string inline: la forma genérica diría "hace 1 días".
  it("el día anterior es 'ayer', nunca 'hace 1 días'", () => {
    expect(relativeDayLabel("2026-07-14", NOW)).toBe("ayer");
  });

  it("más de un día devuelve 'hace N días'", () => {
    expect(relativeDayLabel("2026-07-13", NOW)).toBe("hace 2 días");
    expect(relativeDayLabel("2026-06-24", NOW)).toBe("hace 21 días");
  });

  it("cruza el cambio de mes contando días, no meses", () => {
    expect(relativeDayLabel("2026-06-30", NOW)).toBe("hace 15 días");
  });

  it("tolera iso con tiempo (timestamptz), como dayLabel", () => {
    expect(relativeDayLabel("2026-07-14T23:59:00+00:00", NOW)).toBe("ayer");
  });

  // `now` lo provee el servidor y `last_activity_date` sale de la base: si un
  // registro quedara adelantado, "hace -3 días" sería peor que redondear a hoy.
  it("una fecha futura no produce un conteo negativo", () => {
    expect(relativeDayLabel("2026-07-18", NOW)).toBe("hoy");
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
