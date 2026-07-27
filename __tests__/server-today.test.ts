import { describe, it, expect, afterEach, vi } from "vitest";
import { serverToday } from "@/lib/content/server-today";

const ORIGINAL = process.env.DEV_DATE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DEV_DATE;
  else process.env.DEV_DATE = ORIGINAL;
  vi.useRealTimers();
});

describe("serverToday", () => {
  it("usa DEV_DATE cuando está definida", () => {
    // Arrange
    process.env.DEV_DATE = "2026-03-15";

    // Act
    const today = serverToday();

    // Assert
    expect(today.getFullYear()).toBe(2026);
    expect(today.getMonth()).toBe(2); // marzo
    expect(today.getDate()).toBe(15);
  });

  it("ancla DEV_DATE al mediodía local, no a medianoche", () => {
    // Arrange — medianoche UTC en una zona con offset negativo (México) cae en
    // el día anterior; el mediodía evita esa deriva (misma razón que getTodayContent).
    process.env.DEV_DATE = "2026-03-15";

    // Act
    const today = serverToday();

    // Assert
    expect(today.getHours()).toBe(12);
    expect(today.getMinutes()).toBe(0);
  });

  it("cae al reloj real cuando DEV_DATE no está definida", () => {
    // Arrange
    delete process.env.DEV_DATE;
    vi.useFakeTimers();
    const real = new Date("2026-07-27T09:30:00Z");
    vi.setSystemTime(real);

    // Act
    const today = serverToday();

    // Assert
    expect(today.getTime()).toBe(real.getTime());
  });

  it("ignora una DEV_DATE vacía y usa el reloj real", () => {
    // Arrange — una var de entorno vacía no debe producir un Invalid Date.
    process.env.DEV_DATE = "";
    vi.useFakeTimers();
    const real = new Date("2026-07-27T09:30:00Z");
    vi.setSystemTime(real);

    // Act
    const today = serverToday();

    // Assert
    expect(today.getTime()).toBe(real.getTime());
  });

  it("devuelve una fecha válida (nunca Invalid Date) con DEV_DATE malformada", () => {
    // Arrange
    process.env.DEV_DATE = "no-es-una-fecha";
    vi.useFakeTimers();
    const real = new Date("2026-07-27T09:30:00Z");
    vi.setSystemTime(real);

    // Act
    const today = serverToday();

    // Assert — degradar al reloj real es preferible a propagar NaN a los
    // cálculos de día/semana de todo el portal.
    expect(Number.isNaN(today.getTime())).toBe(false);
    expect(today.getTime()).toBe(real.getTime());
  });

  it("devuelve una instancia nueva en cada llamada", () => {
    // Arrange
    process.env.DEV_DATE = "2026-03-15";

    // Act
    const a = serverToday();
    const b = serverToday();

    // Assert — mutar el resultado no debe contaminar llamadas posteriores.
    a.setFullYear(1999);
    expect(b.getFullYear()).toBe(2026);
  });
});
