import { describe, it, expect } from "vitest";
import {
  contentProgressLabel,
  repeatMarker,
} from "@/lib/portal/progress-display";

const rolling = {
  billingModel: "rolling_monthly",
  durationMonths: null,
  monthsElapsed: 14,
  rungName: "Avanzado",
  contentOrdinal: 2,
  contentLoops: 0,
};

const fixed = {
  billingModel: "fixed_term_monthly",
  durationMonths: 6,
  monthsElapsed: 3,
  rungName: "CuarentaMás",
  contentOrdinal: 3,
  contentLoops: 0,
};

describe("contentProgressLabel", () => {
  it("un programa rolling muestra peldaño y posición, no meses transcurridos", () => {
    // Arrange / Act
    const label = contentProgressLabel(rolling);

    // Assert
    expect(label.text).toBe("Avanzado · Mes 2");
    expect(label.percent).toBeNull();
  });

  it("un programa rolling sin nombre de peldaño cae a la sola posición", () => {
    const label = contentProgressLabel({ ...rolling, rungName: null });

    expect(label.text).toBe("Mes 2");
    expect(label.percent).toBeNull();
  });

  it("un programa de plazo fijo conserva 'Mes X de Y' y su barra", () => {
    const label = contentProgressLabel(fixed);

    expect(label.text).toBe("Mes 3 de 6");
    expect(label.percent).toBe(50);
  });

  it("un plazo fijo sin duración declarada se comporta como rolling", () => {
    const label = contentProgressLabel({ ...fixed, durationMonths: null });

    expect(label.text).toBe("CuarentaMás · Mes 3");
    expect(label.percent).toBeNull();
  });

  it("la barra de plazo fijo nunca pasa de 100", () => {
    const label = contentProgressLabel({ ...fixed, monthsElapsed: 9 });

    expect(label.percent).toBe(100);
  });

  it("el plazo fijo se etiqueta con months_elapsed, no con la posición de contenido", () => {
    // La posición se congela al cumplir el plazo; el mes transcurrido no.
    const label = contentProgressLabel({ ...fixed, monthsElapsed: 4, contentOrdinal: 3 });

    expect(label.text).toBe("Mes 4 de 6");
  });

  // L2c — una suscripción terminada no sigue contando meses. "Mes 6 de 6" es
  // cierto pero no dice lo único que importa: que ya acabó.
  it("una suscripción terminada se anuncia terminada, no como una fracción", () => {
    const label = contentProgressLabel({ ...fixed, monthsElapsed: 6, status: "completed" });

    expect(label.text).toBe("Programa completado");
    expect(label.percent).toBe(100);
  });

  it("terminada manda también sobre la etiqueta rolling", () => {
    expect(contentProgressLabel({ ...rolling, status: "completed" }).text).toBe(
      "Programa completado"
    );
  });

  it("un estado que no es completed no cambia nada", () => {
    expect(contentProgressLabel({ ...fixed, status: "active" }).text).toBe("Mes 3 de 6");
  });
});

describe("repeatMarker", () => {
  it("anuncia la repetición mientras la cliente da vueltas", () => {
    expect(repeatMarker(1, 3)).toBe("Repitiendo Mes 3");
  });

  it("sigue anunciándola en vueltas posteriores", () => {
    expect(repeatMarker(4, 1)).toBe("Repitiendo Mes 1");
  });

  it("no dice nada antes de la primera vuelta", () => {
    expect(repeatMarker(0, 3)).toBeNull();
  });
});
