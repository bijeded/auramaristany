import { contentProgressLabel } from "@/lib/portal/progress-display";
import { deriveCancellationState } from "@/lib/portal/cancellation";
import type { SubscriptionStatus } from "@/lib/supabase/types";
import { dayLabel, daysBetween } from "@/lib/admin/date-helpers";
import { formatMXN } from "@/lib/admin/finance-helpers";

/**
 * La celda de cobro de una suscripción, para el listado Y para la ficha.
 *
 * Existe porque estaban duplicadas: la ficha aprendió que una suscripción
 * terminada ya no cobra y la tabla no, así que el listado le anunciaba a Aura un
 * "Próximo cobro" de una cliente cuya suscripción llevaba días cancelada en
 * Stripe. La pregunta se contesta UNA vez.
 *
 * Es deliberadamente MÁS ancha que `isCompletionScheduled`: aquí no se trata de
 * distinguir terminar de irse, sino de no anunciar un cobro que no va a
 * ocurrir. Eso incluye los estados terminales —terminada, cancelada, impaga
 * (dunning agotado)— y también la baja voluntaria que está agotando su periodo.
 * Se enumeran los estados que SÍ cobran, no los que no: un estado nuevo debe
 * nacer sin anunciar cobros, no anunciándolos hasta que alguien se acuerde.
 *
 * NO mira `completed_at`: a solas no prueba nada (ver `isCompletionScheduled`),
 * y el caso que traería ya lo cubre `cancel_at_period_end`.
 *
 * "Acceso hasta" y no "termina el": una cancelada conserva su
 * `current_period_end` viejo, así que la fecha puede ser de hace meses y el
 * futuro sonaría a que todavía le queda.
 */
const BILLING_STATUSES: readonly SubStatus[] = ["active", "trialing", "past_due"];

export function nextChargeCell(sub: {
  status: SubStatus;
  cancel_at_period_end?: boolean | null;
  current_period_end: string | null;
  price_mxn: number;
}): { kind: "charge" | "ending"; label: string; value: string } {
  const bills = BILLING_STATUSES.includes(sub.status) && sub.cancel_at_period_end !== true;

  if (!sub.current_period_end) {
    return bills
      ? { kind: "charge", label: "Próximo cobro", value: "—" }
      : { kind: "ending", label: "Acceso hasta", value: "—" };
  }
  const date = dayLabel(sub.current_period_end.slice(0, 10));
  return bills
    ? { kind: "charge", label: "Próximo cobro", value: `${date} · ${formatMXN(sub.price_mxn)}` }
    : { kind: "ending", label: "Acceso hasta", value: date };
}

/**
 * Los status de suscripción que el admin puede recibir — TODOS los que la base
 * acepta, no los que a esta pantalla le gustaría que existieran.
 *
 * Era una lista propia de seis mientras el CHECK de `subscriptions.status`
 * (migración 017) admitía nueve, y `handleSubscriptionUpdated` espeja el de
 * Stripe tal cual. La diferencia no era teórica: había un cast `// keep:` en la
 * ruta de borrado que se sabía "más estrecho" y lo tapaba, y un mapa indexado
 * sin salida que tiraba el listado completo con un `paused`.
 *
 * Ahora es un alias: la lista vive en un solo sitio y no puede volver a
 * separarse de la base sin que `tsc` lo note. Ensanchar el tipo no cambió por sí
 * solo ningún comportamiento —esas filas ya llegaban aquí—, pero al hacerlas
 * expresables destapó una que sí había que corregir: ver `incomplete_expired` en
 * `canDeleteClient`.
 */
export type SubStatus = SubscriptionStatus;

/**
 * D17 — "Último mes" y "En cancelación" son las dos cohortes que siguen
 * ACTIVAS: una termina su plazo y la otra se va por su cuenta, y hasta ahora
 * ninguna se distinguía de "Activas". Deliberadamente NO se llaman
 * "Completadas"/"Canceladas": ésas ya terminaron, y con nombres parecidos la
 * fila de pills leería como cuatro sinónimos de lo mismo.
 */
export type StatusFilter =
  | "Activas"
  | "Vencidas"
  | "Canceladas"
  | "Completadas"
  | "Último mes"
  | "En cancelación"
  | "Sin actividad"
  | null;

/**
 * Las etiquetas de las dos cohortes que están terminando, nombradas porque las
 * usan tres sitios: las pills, el validador de la URL y los enlaces de las
 * tarjetas del dashboard. Como literales repetidos, un cambio de nombre en las
 * pills dejaría los enlaces apuntando a un filtro que ya no existe.
 */
export const COHORT_FILTER = {
  /** Plazo fijo en su último mes ya pagado: se gradúa. */
  completing: "Último mes",
  /** Baja voluntaria agotando su periodo. */
  cancelling: "En cancelación",
} as const;

/**
 * Las pills de estado, en el orden en que se muestran. Vive aquí y no dentro del
 * componente porque `parseStatusFilter` necesita la misma lista para validar lo
 * que llega por la URL: dos copias serían dos listas que se separan.
 */
export const STATUS_FILTERS: Exclude<StatusFilter, null>[] = [
  "Activas",
  "Vencidas",
  "Canceladas",
  "Completadas",
  COHORT_FILTER.completing,
  COHORT_FILTER.cancelling,
  "Sin actividad",
];

/**
 * Traduce el `?status=` de la URL a un filtro válido, o a null.
 *
 * D17 — las tarjetas "Terminan" y "Cancelaciones" del dashboard enlazan aquí con
 * la cohorte ya seleccionada, así que el valor entra por la barra de direcciones.
 * NO se puede pasar tal cual al estado: `StatusFilter` es una unión cerrada y
 * cualquiera puede escribir lo que quiera ahí. Lo desconocido se ignora y la
 * lista sale sin filtrar, que es lo que un enlace roto debería hacer.
 */
export function parseStatusFilter(raw: string | string[] | undefined): StatusFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return STATUS_FILTERS.find((f) => f === value) ?? null;
}

/** Umbral por defecto (en días) para el filtro "Sin actividad". Reutilizable por A4. */
export const INACTIVITY_THRESHOLD_DAYS = 10;

export interface ClientListRow {
  profile_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  program_name: string;
  variant_name: string;
  enrollment_date: string;       // ISO date
  current_period_end: string | null; // ISO
  price_mxn: number;
  status: SubStatus;
  /** Sin esto la tabla anunciaba cobros de suscripciones que ya no cobran. */
  cancel_at_period_end: boolean;
  /**
   * D17 — hace falta junto con la bandera para saber si el final está
   * PROGRAMADO. `cancel_at_period_end` a solas no distingue graduarse de irse:
   * las dos lo traen puesto. Lo consume `isCompletionScheduled`, no `nextChargeCell`.
   */
  completed_at: string | null;
  last_activity_date: string | null; // max progress_logs.log_date (YYYY-MM-DD) o null
}

/**
 * Un cliente está inactivo si su última actividad es de hace ≥ thresholdDays,
 * o si nunca registró actividad (lastActivityDate === null). `now` lo provee el
 * servidor (DEV_DATE-aware), nunca el reloj del navegador.
 */
export function isInactive(
  lastActivityDate: string | null,
  now: string,
  thresholdDays: number
): boolean {
  if (lastActivityDate === null) return true;
  return daysBetween(lastActivityDate, now) >= thresholdDays;
}

export function filterClients(
  rows: ClientListRow[],
  opts: { query: string; program: string; status: StatusFilter; now: string }
): ClientListRow[] {
  const q = opts.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !(`${r.full_name} ${r.email}`.toLowerCase().includes(q))) return false;
    if (opts.program !== "Todas" && r.program_name !== opts.program) return false;
    if (opts.status === "Activas" && r.status !== "active") return false;
    if (opts.status === "Vencidas" && r.status !== "past_due" && r.status !== "unpaid") return false;
    if (opts.status === "Canceladas" && r.status !== "canceled") return false;
    // L2c — terminar no es cancelar. Tiene su propio filtro para que Aura
    // pueda ver de un vistazo a quién ofrecerle Extra.
    if (opts.status === "Completadas" && r.status !== "completed") return false;
    // D17 — las dos cohortes que siguen activas. La pertenencia se decide con la
    // MISMA derivación que el portal y el dashboard: `completed_at` a solas no
    // prueba nada (L2b lo escribía sin cancelar en Stripe), y leer la bandera
    // suelta confundiría graduarse con irse, que es el error que L2c ya cazó
    // tres veces.
    if (opts.status === "Último mes" || opts.status === "En cancelación") {
      // Este guard es CARGA, no adorno: el `kind` a solas no filtra por status.
      // `deriveCancellationState` sólo cortocircuita en `completed` antes de
      // `isCompletionScheduled`, así que con las dos señales puestas devuelve
      // "completing" para cualquier otro status —incluida una `canceled` con una
      // marca vieja— sin llegar a mirar ELIGIBLE_STATUSES. Dos pruebas lo fijan.
      if (r.status !== "active") return false;
      // La cohorte la nombra `deriveCancellationState`, la MISMA función que usa
      // el portal y de la que salen las tarjetas del dashboard. No se leen las
      // banderas aquí: el orden importa —`cancel_at_period_end` también lo trae
      // quien se gradúa— y ése es justo el error que L2c cazó tres veces.
      const kind = deriveCancellationState({
        status: r.status,
        cancelAtPeriodEnd: r.cancel_at_period_end,
        completedAt: r.completed_at,
      }).kind;
      const wanted = opts.status === "Último mes" ? "completing" : "grace";
      if (kind !== wanted) return false;
    }
    if (opts.status === "Sin actividad") {
      const paying = r.status === "active" || r.status === "trialing";
      if (!paying || !isInactive(r.last_activity_date, opts.now, INACTIVITY_THRESHOLD_DAYS)) return false;
    }
    return true;
  });
}

export interface SubLike {
  status: SubStatus;
  current_period_end: string | null;
  enrollment_date: string;
  created_at: string;
}

export function pickPrimarySubscription<T extends SubLike>(subs: T[]): T | null {
  if (subs.length === 0) return null;
  const actives = subs.filter((s) => s.status === "active");
  if (actives.length > 0) {
    return actives.reduce((best, s) =>
      (s.current_period_end ?? "") > (best.current_period_end ?? "") ? s : best
    );
  }
  return subs.reduce((best, s) =>
    s.enrollment_date > best.enrollment_date ? s : best
  );
}

/**
 * El progreso de una suscripción tal como lo ve Aura.
 *
 * Dice lo mismo que el portal de la cliente —peldaño y posición en rolling,
 * fracción en plazo fijo— porque la conversación entre las dos falla si cada
 * pantalla cuenta el avance de otra manera.
 */
export function subscriptionProgressLabel(
  sub: {
    months_elapsed: number;
    content_ordinal: number;
    content_loops: number;
    rung_name: string | null;
    status?: string;
  },
  program: { billing_model: string; duration_months: number | null }
): string {
  return contentProgressLabel({
    billingModel: program.billing_model,
    durationMonths: program.duration_months,
    monthsElapsed: sub.months_elapsed,
    rungName: sub.rung_name,
    contentOrdinal: sub.content_ordinal,
    contentLoops: sub.content_loops,
    status: sub.status,
  }).text;
}

export function canDeleteClient(
  subs: { status: SubStatus }[]
): { ok: boolean; reason?: string } {
  // L2c — `completed` es terminal y su cobro ya está cancelado a fin de
  // periodo, así que no es una suscripción viva: contarla como tal dejaría a la
  // cliente imposible de borrar para siempre, porque nunca pasará a `canceled`.
  //
  // `incomplete_expired` es el MISMO defecto con otro valor, y sólo se pudo ver
  // al ensanchar el tipo: es una suscripción que murió sin cobrar nunca —Stripe
  // la marca así cuando el primer pago no se completa en 23 horas— y es final,
  // no pasa a `canceled`. Contándola como viva, el guard le pedía a Aura
  // "cancélala en Stripe" cuando no hay nada que cancelar, y esa cliente no se
  // podía borrar jamás. `paused` e `incomplete` sí siguen vivas: las dos pueden
  // volver a cobrar.
  const DEAD: readonly SubStatus[] = ["canceled", "completed", "incomplete_expired"];
  const live = subs.some((s) => !DEAD.includes(s.status));
  if (live) {
    return { ok: false, reason: "Tiene una suscripción activa. Cancélala en Stripe antes de eliminar." };
  }
  return { ok: true };
}

/**
 * Cómo se pinta un status de suscripción: etiqueta en español y colores.
 *
 * La clave es `string`, NO `SubStatus`, y eso es el arreglo entero. La migración
 * 017 ensanchó el CHECK de `subscriptions.status` a NUEVE valores a propósito
 * —para que espejar el status de Stripe no fuera rechazado y la fila no se
 * quedara contando otra historia—, pero la UI siguió modelando seis. Había DOS
 * mapas de esto (uno aquí para el CSV y otro dentro de ClientsTable), copias de
 * la misma tabla, y por eso a los dos les faltaban exactamente los mismos tres:
 * `incomplete`, `incomplete_expired` y `paused`. El de la tabla se indexaba sin
 * salida, así que un `paused` devolvía undefined y `badge.label` tiraba el
 * render: no esa fila, el listado COMPLETO. Bastaba con que Aura pausara una
 * suscripción desde el dashboard de Stripe.
 *
 * El fallback no es paranoia: el CHECK puede volver a ensancharse sin que nadie
 * se acuerde de esta pantalla, y entonces un status nuevo debe verse raro, no
 * borrar la lista de clientes de Aura.
 */
// Ámbar = "todavía puede cobrar". Vive en globals.css porque el hex estaba
// repetido a mano en cinco archivos; quedan tres por convertir (payment-status,
// SubscriptionCard, ClientDetailTabs), anotados en BACKLOG.
const AMBAR = { bg: "var(--ambar-tint)", color: "var(--ambar)" };

const STATUS_PRESENTATION: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "Activa", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  trialing: { label: "Prueba", bg: "var(--lavanda-soft)", color: "var(--lavanda-dark)" },
  past_due: { label: "Pago fallido", bg: "var(--error-tint)", color: "var(--error)" },
  unpaid: { label: "Impaga", ...AMBAR },
  canceled: { label: "Cancelada", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  // L2c — terminó el programa completo. Es un logro, no una baja: verde como
  // la activa, para que Aura no la lea de un vistazo como una cliente perdida.
  completed: { label: "Completada", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  // Los tres que la base ya aceptaba y aquí no existían. Ámbar los dos que
  // pueden volver a cobrar; gris el que murió sin llegar a cobrar nunca.
  paused: { label: "Pausada", ...AMBAR },
  incomplete: { label: "Incompleta", ...AMBAR },
  incomplete_expired: { label: "Expirada", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
};

export function statusBadge(status: string): { label: string; bg: string; color: string } {
  return (
    STATUS_PRESENTATION[status] ?? {
      // Se muestra el valor crudo: es feo a propósito, y es infinitamente mejor
      // que una tabla en blanco. Mismo criterio que la celda de pagos de la ficha.
      label: status,
      bg: "var(--gris-claro)",
      color: "var(--gris-texto)",
    }
  );
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function clientsToCSV(rows: ClientListRow[]): string {
  // El encabezado y el arreglo de abajo son POSICIONALES: una columna añadida a
  // uno y no al otro desalinea el CSV entero sin que nada falle.
  // Se exporta `last_activity_date` crudo, no "hace 21 días": la etiqueta
  // relativa se congela al exportar y miente al día siguiente, y una hoja de
  // cálculo ordena y filtra por fecha, no por prosa.
  const header = "Nombre,Email,Programa,Variante,Estado,Inscripción,Último acceso";
  const lines = rows.map((r) =>
    [r.full_name, r.email, r.program_name, r.variant_name, statusBadge(r.status).label, r.enrollment_date, r.last_activity_date ?? ""]
      .map(csvCell)
      .join(",")
  );
  return [header, ...lines].join("\n");
}
