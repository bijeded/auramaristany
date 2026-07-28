/**
 * La escalera de niveles: dónde está una cliente en el contenido y hacia dónde
 * sigue cuando paga un mes más.
 *
 * Strong & Fit son seis meses de Principiante, seis de Intermedio y Avanzado
 * indefinidamente; CuarentaMás Extra son seis de Intermedio y luego Avanzado.
 * La posición NO se deriva de `months_elapsed` ni de ningún conteo: es estado
 * guardado en la suscripción (`content_variant_id`, `content_ordinal`,
 * `content_loops`) que avanza un paso por cada mes cobrado.
 *
 * Por qué no se deriva: el catálogo de Avanzado crece por diseño. Cualquier
 * posición calculada sobre un conteo (un módulo, un bloque de seis meses) se
 * reordena sola cuando Aura publica una serie más, y baraja a todas las
 * clientes que ya iban dando vueltas.
 *
 * Esta función es pura: no consulta la base de datos. Recibe el currículo ya
 * leído y devuelve la posición siguiente.
 */

import {
  firstOrdinal,
  nextOrdinal,
  type CurriculumEntry,
} from "@/lib/content/curriculum";

/** Dónde está una cliente: en qué peldaño, en qué posición y cuántas vueltas lleva. */
export interface LadderPosition {
  /** El peldaño actual — `subscriptions.content_variant_id`. */
  variantId: string;
  /** La posición dentro de ese peldaño — `subscriptions.content_ordinal`. */
  ordinal: number;
  /** Vueltas completadas en el último peldaño — `subscriptions.content_loops`. */
  loops: number;
}

/** El peldaño siguiente declarado por la variante, con su currículo. */
export interface NextRung {
  variantId: string;
  entries: CurriculumEntry[];
}

export interface AdvanceInput {
  position: LadderPosition;
  /**
   * Las series mapeadas al peldaño actual, leídas en el momento de avanzar.
   * Nunca un conteo guardado: publicar contenido no debe mover a nadie hacia
   * atrás ni hacia adelante, sólo cambiar qué hay por delante.
   */
  currentRung: CurriculumEntry[];
  /** El peldaño que declara `ladder_next_variant_id`, o `null` si es el último. */
  nextRung: NextRung | null;
  billingModel: "fixed_term_monthly" | "rolling_monthly";
  durationMonths: number | null;
  /**
   * ⚠ El `months_elapsed` guardado ANTES de contar la factura que dispara este
   * avance, no después. La convención es load-bearing y no la fija ningún test
   * que elija a la vez posición y mes: con el valor ya incrementado, una
   * CuarentaMás de 6 meses se congelaría en la posición 5 al pagar su sexto mes
   * y no vería nunca el último mes de su programa.
   *
   * Dicho de otro modo: al llegar la sexta factura este valor es 5 —la cliente
   * lleva cinco meses— y avanza a la posición 6; al llegar una séptima es 6 y
   * se congela.
   */
  monthsElapsed: number;
}

/**
 * La posición tras cobrar un mes. Las ramas se evalúan EN ESTE ORDEN:
 *
 *   1.  plazo fijo cumplido           → congela
 *   2.  queda posición por delante    → la más baja de las que existen por encima
 *   3.  hay peldaño siguiente CON contenido → su primera posición
 *   3b. hay peldaño siguiente SIN contenido → congela
 *   4.  no hay peldaño siguiente      → vuelta al principio, `loops += 1`
 *
 * ⚠ El orden importa. La rama 1 va ANTES que la 4 porque las variantes de
 * CuarentaMás no declaran peldaño siguiente: sin la guarda cumplirían la
 * condición de vuelta y repetirían el programa indefinidamente mientras se les
 * sigue cobrando. La guarda vive aquí y no en `l2-rolling-billing-extra`
 * porque los cambios se despliegan por separado y éste tiene que ser correcto
 * por sí solo.
 */
export function advanceLadderPosition(input: AdvanceInput): LadderPosition {
  const { position, currentRung, nextRung } = input;

  // 1. Plazo fijo cumplido: la posición se congela. Terminar de verdad la
  //    suscripción (cancelar en Stripe, marcar el estado) es de otro cambio;
  //    aquí basta con no seguir moviendo el contenido.
  if (hasCompletedFixedTerm(input)) return position;

  // 2. Dentro del peldaño. El sucesor es el siguiente ordinal QUE EXISTE, no
  //    `ordinal + 1`: borrar un mapeo intermedio deja huecos (1,2,4,5,6) y
  //    tratar el hueco como fin de nivel adelanta a la cliente meses antes.
  const within = nextOrdinal(currentRung, position.ordinal);
  if (within !== null) return { ...position, ordinal: within };

  // 3. Cambio de peldaño, a su primera posición existente (tampoco un 1 fijo).
  const nextRungStart = nextRung ? firstOrdinal(nextRung.entries) : null;
  if (nextRung && nextRungStart !== null) {
    return { ...position, variantId: nextRung.variantId, ordinal: nextRungStart };
  }

  // 3b. Peldaño siguiente DECLARADO pero todavía sin series: se congela.
  //
  //     No es lo mismo que ser el último peldaño. Una Principiante que termina
  //     el mes 6 sin ningún Intermedio publicado daría la vuelta a
  //     Principiante 1 con una vuelta contada: un estado erróneo que persiste,
  //     que se lee como un bug y que no se corrige solo cuando Aura publique.
  //     Congelada entra en Intermedio en el siguiente cobro en cuanto exista la
  //     primera serie. La señal de agotamiento de contenido en el admin existe
  //     para que Aura lo vea venir antes de que ocurra.
  if (nextRung) return position;

  // 4. Último peldaño agotado: vuelta al principio. Si el peldaño actual está
  //    vacío no hay a dónde volver y la posición se congela.
  const wrapTo = firstOrdinal(currentRung);
  if (wrapTo === null) return position;

  return { ...position, ordinal: wrapTo, loops: position.loops + 1 };
}

/** Un programa de plazo fijo que ya cumplió los meses que dura. */
function hasCompletedFixedTerm(input: AdvanceInput): boolean {
  return (
    input.billingModel === "fixed_term_monthly" &&
    input.durationMonths !== null &&
    input.monthsElapsed >= input.durationMonths
  );
}
