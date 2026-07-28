import { describe, it, expect } from "vitest";
import {
  advanceLadderPosition,
  resolveContentPosition,
  type AdvanceInput,
  type LadderPosition,
} from "@/lib/content/ladder";
import type { CurriculumEntry } from "@/lib/content/curriculum";

// ── Utilidades de armado ─────────────────────────────────────────────────────

function entries(...ordinals: number[]): CurriculumEntry[] {
  return ordinals.map((ordinal) => ({ ordinal, series_id: `s${ordinal}` }));
}

const PRINCIPIANTE = "v-principiante";
const INTERMEDIO = "v-intermedio";
const AVANZADO = "v-avanzado";

/** Una escalera rodante (Strong & Fit): tres peldaños de 6 posiciones. */
function rolling(overrides: Partial<AdvanceInput> = {}): AdvanceInput {
  return {
    position: { variantId: AVANZADO, ordinal: 1, loops: 0 },
    currentRung: entries(1, 2, 3, 4, 5, 6),
    nextRung: null,
    billingModel: "rolling_monthly",
    durationMonths: null,
    monthsElapsed: 1,
    ...overrides,
  };
}

/** Un programa de plazo fijo (CuarentaMás): 6 meses y no hay peldaño siguiente. */
function fixedTerm(overrides: Partial<AdvanceInput> = {}): AdvanceInput {
  return {
    position: { variantId: PRINCIPIANTE, ordinal: 1, loops: 0 },
    currentRung: entries(1, 2, 3, 4, 5, 6),
    nextRung: null,
    billingModel: "fixed_term_monthly",
    durationMonths: 6,
    monthsElapsed: 1,
    ...overrides,
  };
}

function position(
  variantId: string,
  ordinal: number,
  loops: number
): LadderPosition {
  return { variantId, ordinal, loops };
}

// ── Rama 2: avance dentro del peldaño ────────────────────────────────────────

describe("advanceLadderPosition — dentro del peldaño", () => {
  it("avanza una posición y no toca la variante ni las vueltas", () => {
    const next = advanceLadderPosition(
      rolling({ position: position(AVANZADO, 3, 0) })
    );

    expect(next).toEqual(position(AVANZADO, 4, 0));
  });

  it("el sucesor es el siguiente ordinal QUE EXISTE, nunca +1", () => {
    // Con `+1` la posición 3 no existe, el lector concluye "se acabó el nivel"
    // y adelanta a la cliente al siguiente peldaño meses antes de tiempo.
    const next = advanceLadderPosition(
      rolling({
        position: position(PRINCIPIANTE, 2, 0),
        currentRung: entries(1, 2, 4, 5, 6),
        nextRung: { variantId: INTERMEDIO, entries: entries(1, 2, 3) },
      })
    );

    expect(next).toEqual(position(PRINCIPIANTE, 4, 0));
  });

  it("desde una posición anterior a todo el peldaño, entra en la primera que existe", () => {
    const next = advanceLadderPosition(
      rolling({ position: position(AVANZADO, 2, 0), currentRung: entries(5, 6) })
    );

    expect(next).toEqual(position(AVANZADO, 5, 0));
  });
});

// ── Rama 3: cambio de peldaño ────────────────────────────────────────────────

describe("advanceLadderPosition — cambio de peldaño", () => {
  it("al agotar el peldaño pasa al siguiente, en su primera posición", () => {
    const next = advanceLadderPosition(
      rolling({
        position: position(PRINCIPIANTE, 6, 0),
        nextRung: { variantId: INTERMEDIO, entries: entries(1, 2, 3, 4, 5, 6) },
      })
    );

    expect(next).toEqual(position(INTERMEDIO, 1, 0));
  });

  it("la primera posición del peldaño nuevo es la más baja que existe, no un 1 fijo", () => {
    const next = advanceLadderPosition(
      rolling({
        position: position(PRINCIPIANTE, 6, 0),
        nextRung: { variantId: INTERMEDIO, entries: entries(4, 5, 6) },
      })
    );

    expect(next).toEqual(position(INTERMEDIO, 4, 0));
  });

  it("cambiar de peldaño no incrementa las vueltas", () => {
    const next = advanceLadderPosition(
      rolling({
        position: position(INTERMEDIO, 6, 2),
        nextRung: { variantId: AVANZADO, entries: entries(1, 2) },
      })
    );

    expect(next.loops).toBe(2);
  });
});

// ── Rama 4: vuelta en el último peldaño ──────────────────────────────────────

describe("advanceLadderPosition — vuelta en el último peldaño", () => {
  it("al agotar el último peldaño vuelve al principio y suma una vuelta", () => {
    const next = advanceLadderPosition(
      rolling({ position: position(AVANZADO, 6, 0) })
    );

    expect(next).toEqual(position(AVANZADO, 1, 1));
  });

  it("vuelve a la posición más baja que existe, no a un 1 fijo", () => {
    const next = advanceLadderPosition(
      rolling({
        position: position(AVANZADO, 9, 0),
        currentRung: entries(3, 6, 9),
      })
    );

    expect(next).toEqual(position(AVANZADO, 3, 1));
  });

  it("acumula vueltas sucesivas", () => {
    const next = advanceLadderPosition(
      rolling({ position: position(AVANZADO, 6, 3) })
    );

    expect(next.loops).toBe(4);
  });
});

// ── La longitud del peldaño se lee al avanzar, nunca de un conteo guardado ────

describe("advanceLadderPosition — contenido nuevo publicado", () => {
  it("alcanza el contenido recién publicado en lugar de dar la vuelta", () => {
    // Estaba en la última (6) y Aura publica la 7: avanza HACIA ella.
    const next = advanceLadderPosition(
      rolling({
        position: position(AVANZADO, 6, 0),
        currentRung: entries(1, 2, 3, 4, 5, 6, 7),
      })
    );

    expect(next).toEqual(position(AVANZADO, 7, 0));
  });

  it("publicar contenido no reordena a una cliente que ya daba vueltas", () => {
    // Cada cliente avanza UN paso desde su propia posición: sin baraja.
    const rung = entries(1, 2, 3, 4, 5, 6, 7);
    const enLaDos = advanceLadderPosition(
      rolling({ position: position(AVANZADO, 2, 1), currentRung: rung })
    );
    const enLaSeis = advanceLadderPosition(
      rolling({ position: position(AVANZADO, 6, 1), currentRung: rung })
    );

    expect(enLaDos).toEqual(position(AVANZADO, 3, 1));
    expect(enLaSeis).toEqual(position(AVANZADO, 7, 1));
  });
});

// ── Rama 1: congelación de plazo fijo, ANTES que la vuelta ───────────────────

describe("advanceLadderPosition — plazo fijo", () => {
  it("avanza normalmente antes de cumplir la duración", () => {
    const next = advanceLadderPosition(
      fixedTerm({ position: position(PRINCIPIANTE, 3, 0), monthsElapsed: 3 })
    );

    expect(next).toEqual(position(PRINCIPIANTE, 4, 0));
  });

  it("se congela al alcanzar la duración: NO da la vuelta", () => {
    // La rama de plazo fijo se evalúa ANTES que la de vuelta. Sin este orden,
    // CuarentaMás —cuyas variantes no declaran peldaño siguiente— cumpliría la
    // condición de vuelta y repetiría el programa indefinidamente cobrando.
    const next = advanceLadderPosition(
      fixedTerm({ position: position(PRINCIPIANTE, 6, 0), monthsElapsed: 6 })
    );

    expect(next).toEqual(position(PRINCIPIANTE, 6, 0));
  });

  it("sigue congelada pasada la duración", () => {
    const next = advanceLadderPosition(
      fixedTerm({ position: position(PRINCIPIANTE, 6, 0), monthsElapsed: 9 })
    );

    expect(next).toEqual(position(PRINCIPIANTE, 6, 0));
  });

  it("la congelación gana también sobre el avance dentro del peldaño", () => {
    // Aunque queden posiciones por delante, cumplida la duración no avanza.
    const next = advanceLadderPosition(
      fixedTerm({ position: position(PRINCIPIANTE, 4, 0), monthsElapsed: 6 })
    );

    expect(next).toEqual(position(PRINCIPIANTE, 4, 0));
  });

  it("la congelación gana también sobre el cambio de peldaño", () => {
    // CuarentaMás Extra declara Avanzado como siguiente pero sigue siendo de
    // plazo fijo hasta `l2-rolling-billing-extra`: a los 6 meses se detiene.
    const next = advanceLadderPosition(
      fixedTerm({
        position: position(INTERMEDIO, 6, 0),
        nextRung: { variantId: AVANZADO, entries: entries(1, 2, 3) },
        monthsElapsed: 6,
      })
    );

    expect(next).toEqual(position(INTERMEDIO, 6, 0));
  });

  it("`monthsElapsed` es el valor ANTERIOR a contar esta factura", () => {
    // Convención de la frontera, invisible para un test que elija a la vez
    // posición y mes: con el valor ya incrementado, una CuarentaMás de 6 meses
    // se congelaría en la posición 5 al pagar su sexto mes y no vería nunca el
    // último mes de su programa. Recorrido completo de las seis facturas:
    let pos = position(PRINCIPIANTE, 1, 0);
    for (let previousMonths = 1; previousMonths <= 5; previousMonths++) {
      pos = advanceLadderPosition(
        fixedTerm({ position: pos, monthsElapsed: previousMonths })
      );
    }

    // Las cinco facturas posteriores a la inicial la dejan en el mes 6...
    expect(pos).toEqual(position(PRINCIPIANTE, 6, 0));
    // ...y una séptima factura ya no la mueve.
    expect(
      advanceLadderPosition(fixedTerm({ position: pos, monthsElapsed: 6 }))
    ).toEqual(position(PRINCIPIANTE, 6, 0));
  });

  it("sin duración declarada no se congela nunca", () => {
    const next = advanceLadderPosition(
      fixedTerm({
        position: position(PRINCIPIANTE, 6, 0),
        durationMonths: null,
        monthsElapsed: 99,
      })
    );

    expect(next).toEqual(position(PRINCIPIANTE, 1, 1));
  });

  it("un programa rodante nunca se congela por la guarda", () => {
    const next = advanceLadderPosition(
      rolling({ position: position(AVANZADO, 6, 0), monthsElapsed: 99 })
    );

    expect(next).toEqual(position(AVANZADO, 1, 1));
  });
});

// ── Currículos incompletos: se congela, nunca se inventa una posición ────────

describe("advanceLadderPosition — currículo incompleto", () => {
  it("con el peldaño siguiente declarado pero SIN contenido, se congela", () => {
    // El caso peligroso de la señal de agotamiento: una Principiante que
    // termina el mes 6 sin ninguna serie de Intermedio. Dar la vuelta la
    // mandaría a Principiante 1 con una vuelta contada —un estado erróneo que
    // persiste—; congelarla la deja donde está y el siguiente cobro la mete en
    // Intermedio en cuanto Aura publique la primera serie.
    const next = advanceLadderPosition(
      rolling({
        position: position(PRINCIPIANTE, 6, 0),
        nextRung: { variantId: INTERMEDIO, entries: [] },
      })
    );

    expect(next).toEqual(position(PRINCIPIANTE, 6, 0));
  });

  it("con el peldaño actual vacío, se congela", () => {
    const next = advanceLadderPosition(
      rolling({ position: position(AVANZADO, 1, 0), currentRung: [] })
    );

    expect(next).toEqual(position(AVANZADO, 1, 0));
  });
});

// ── Pureza ───────────────────────────────────────────────────────────────────

describe("advanceLadderPosition — pureza", () => {
  it("no muta la posición recibida", () => {
    const original = position(AVANZADO, 6, 0);
    const input = rolling({ position: original });

    advanceLadderPosition(input);

    expect(original).toEqual(position(AVANZADO, 6, 0));
  });
});

// ── Resolución del puntero para los lectores ────────────────────────────────

describe("resolveContentPosition", () => {
  it("usa el puntero, no la variante comprada", () => {
    // El caso que motiva el cambio: sube de peldaño y deja de coincidir con lo
    // que paga. Servir `program_variant_id` sería contenido del nivel
    // equivocado.
    const position = resolveContentPosition({
      content_variant_id: AVANZADO,
      content_ordinal: 2,
      program_variant_id: PRINCIPIANTE,
    });

    expect(position).toEqual({ variantId: AVANZADO, ordinal: 2 });
  });

  it("sin puntero cae a la variante comprada", () => {
    // Red por si alguna fila se creara sin inicializar: es exactamente dónde
    // estaría si nunca hubiera subido de peldaño.
    const position = resolveContentPosition({
      content_variant_id: null,
      content_ordinal: 3,
      program_variant_id: PRINCIPIANTE,
    });

    expect(position).toEqual({ variantId: PRINCIPIANTE, ordinal: 3 });
  });

  it("sin puntero NI variante devuelve null en vez de inventarse una posición", () => {
    const position = resolveContentPosition({
      content_variant_id: null,
      content_ordinal: 1,
      program_variant_id: null,
    });

    expect(position).toBeNull();
  });
});
