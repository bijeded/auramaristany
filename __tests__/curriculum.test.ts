import { describe, it, expect } from "vitest";
import {
  firstOrdinal,
  nextOrdinal,
  seriesAtOrdinal,
  type CurriculumEntry,
} from "@/lib/content/curriculum";

// Un currículo = las series mapeadas a UNA variante, cada una en su posición.
// El orden de entrada es deliberadamente arbitrario: la posición la da `ordinal`,
// nunca el orden en que la consulta devolvió las filas.
function entries(...ordinals: number[]): CurriculumEntry[] {
  return ordinals.map((ordinal) => ({ ordinal, series_id: `s${ordinal}` }));
}

const CONTIGUOUS = entries(3, 1, 5, 2, 4, 6); // 1..6, desordenadas a propósito
const WITH_GAP = entries(1, 2, 4, 5, 6); // falta la 3
const EMPTY: CurriculumEntry[] = [];

describe("firstOrdinal", () => {
  it("devuelve el ordinal más bajo, no el primero de la lista", () => {
    expect(firstOrdinal(CONTIGUOUS)).toBe(1);
  });

  it("no asume que el currículo empieza en 1", () => {
    expect(firstOrdinal(entries(4, 7, 5))).toBe(4);
  });

  it("devuelve null en un currículo vacío", () => {
    expect(firstOrdinal(EMPTY)).toBeNull();
  });
});

describe("nextOrdinal — currículo contiguo", () => {
  it("avanza una posición", () => {
    expect(nextOrdinal(CONTIGUOUS, 3)).toBe(4);
  });

  it("avanza desde la primera posición", () => {
    expect(nextOrdinal(CONTIGUOUS, 1)).toBe(2);
  });

  it("devuelve null en la última posición (fin del currículo)", () => {
    expect(nextOrdinal(CONTIGUOUS, 6)).toBeNull();
  });
});

describe("nextOrdinal — huecos", () => {
  // El bug que esto previene: con `current + 1` la posición 3 no existe, el lector
  // concluye "se acabó el nivel" y adelanta a la cliente al siguiente nivel meses antes.
  it("salta el hueco: el sucesor de 2 es 4, no 3", () => {
    expect(nextOrdinal(WITH_GAP, 2)).toBe(4);
  });

  it("salta huecos consecutivos", () => {
    expect(nextOrdinal(entries(1, 5), 1)).toBe(5);
  });

  it("sigue detectando el fin real tras un hueco", () => {
    expect(nextOrdinal(WITH_GAP, 6)).toBeNull();
  });
});

describe("nextOrdinal — posiciones fuera del currículo", () => {
  it("desde una posición que ya no existe, avanza a la siguiente que sí existe", () => {
    // La cliente estaba en la 3 y Aura borró ese mapeo: no se queda encallada.
    expect(nextOrdinal(WITH_GAP, 3)).toBe(4);
  });

  it("desde una posición anterior al currículo, devuelve la primera", () => {
    expect(nextOrdinal(entries(4, 5), 1)).toBe(4);
  });

  it("desde una posición posterior al currículo, devuelve null", () => {
    expect(nextOrdinal(WITH_GAP, 99)).toBeNull();
  });

  it("devuelve null en un currículo vacío", () => {
    expect(nextOrdinal(EMPTY, 1)).toBeNull();
  });
});

describe("seriesAtOrdinal", () => {
  it("resuelve la serie de una posición", () => {
    expect(seriesAtOrdinal(CONTIGUOUS, 4)).toBe("s4");
  });

  it("devuelve null si no hay serie en esa posición", () => {
    expect(seriesAtOrdinal(WITH_GAP, 3)).toBeNull();
  });

  it("devuelve null en un currículo vacío", () => {
    expect(seriesAtOrdinal(EMPTY, 1)).toBeNull();
  });
});

describe("una serie compartida ocupa posiciones independientes por variante", () => {
  // Requisito: la posición vive en el mapeo, no en la serie. La misma serie puede
  // ser el Mes 1 de una variante y el Mes 4 de otra.
  const intermedio: CurriculumEntry[] = [
    { ordinal: 1, series_id: "compartida" },
    { ordinal: 2, series_id: "s-b" },
  ];
  const avanzado: CurriculumEntry[] = [
    { ordinal: 3, series_id: "s-c" },
    { ordinal: 4, series_id: "compartida" },
  ];

  it("la misma serie se resuelve en su propia posición en cada variante", () => {
    expect(seriesAtOrdinal(intermedio, 1)).toBe("compartida");
    expect(seriesAtOrdinal(avanzado, 4)).toBe("compartida");
  });

  it("la posición de una variante no existe en la otra", () => {
    expect(seriesAtOrdinal(avanzado, 1)).toBeNull();
    expect(seriesAtOrdinal(intermedio, 4)).toBeNull();
  });

  it("cada variante avanza dentro de su propio currículo", () => {
    expect(nextOrdinal(intermedio, 1)).toBe(2);
    expect(nextOrdinal(avanzado, 3)).toBe(4);
  });
});
