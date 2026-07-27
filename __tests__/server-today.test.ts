import { describe, it, expect, afterEach, vi } from "vitest";
import { serverToday } from "@/lib/content/server-today";

const ORIGINAL = process.env.DEV_DATE;
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DEV_DATE;
  else process.env.DEV_DATE = ORIGINAL;
  if (ORIGINAL_VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
  vi.restoreAllMocks();
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

  it("IGNORA DEV_DATE en producción aunque esté definida", () => {
    // Arrange — DEV_DATE es una env var normal: nada impide ponerla por error en
    // Vercel. Ahí congelaría el "hoy" de toda la plataforma (contenido del día
    // equivocado, log_date congelado y, con A4, period_keys que nunca avanzan).
    process.env.DEV_DATE = "2020-01-01";
    process.env.VERCEL_ENV = "production";
    vi.useFakeTimers();
    const real = new Date("2026-07-27T09:30:00Z");
    vi.setSystemTime(real);

    // Act
    const today = serverToday();

    // Assert
    expect(today.getTime()).toBe(real.getTime());
    expect(today.getFullYear()).not.toBe(2020);
  });

  it("avisa por consola cuando descarta una DEV_DATE malformada", () => {
    // Arrange — degradar es correcto, pero en silencio una errata no da señal.
    process.env.DEV_DATE = "15-03-2026"; // formato invertido, error típico
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Act
    serverToday();

    // Assert
    expect(warn).toHaveBeenCalled();
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
