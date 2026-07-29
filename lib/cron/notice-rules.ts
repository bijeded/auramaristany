// Reglas puras de los mensajes automáticos (A4). Sin BD, sin reloj: `now` se
// inyecta siempre. Ésta es TODA la superficie de riesgo del cron — la ruta sólo
// autentica, orquesta y reporta.
//
// Se reutilizan los helpers ya existentes en lugar de reimplementarlos:
//   getCurrentDayKey  → lib/content/access.ts
//   isInactive / INACTIVITY_THRESHOLD_DAYS     → lib/admin/clients-helpers.ts
//   subscriptionGrantsAccess                   → lib/content/subscription-access.ts
import { getCurrentDayKey, type DayOfWeek } from "@/lib/content/access";
import {
  INACTIVITY_THRESHOLD_DAYS,
  isInactive,
  type SubStatus,
} from "@/lib/admin/clients-helpers";
import { subscriptionGrantsAccess } from "@/lib/content/subscription-access";
import { isCompletionScheduled } from "@/lib/portal/cancellation";
import type { NoticeRule } from "@/lib/supabase/types";

export interface NoticeCandidate {
  profile_id: string;
  email: string;
  full_name: string | null;
  status: SubStatus;
  cancel_at_period_end: boolean;
  /** L2c — distingue "se va" de "está terminando su último mes pagado". */
  completed_at?: string | null;
  /** timestamptz del inicio del periodo de facturación vigente. */
  current_period_start: string;
  /** date (YYYY-MM-DD); centinela de la clave cuando nunca hubo actividad. */
  enrollment_date: string;
  /** Serie del mes en curso, ya resuelta por la capa de queries (puntero de contenido). */
  series_id: string | null;
  /** max(progress_logs.log_date) — la señal que dejó A5. */
  last_activity_date: string | null;
  /** ¿tiene una llamada futura no cancelada? — regla de A6. */
  has_future_call: boolean;
}

export interface NoticeTemplate {
  subject: string;
  body: string;
  is_active: boolean;
}

export type NoticeTemplates = Record<NoticeRule, NoticeTemplate>;

export interface NoticeIntent {
  profile_id: string;
  email: string;
  rule: NoticeRule;
  period_key: string;
  subject: string;
  body: string;
}

// --- Claves ---------------------------------------------------------------

/** Clave de una celda de contenido con bloque "agendar". */
export function agendarCellKey(seriesId: string, weekNumber: number, dayOfWeek: string): string {
  return `${seriesId}|W${weekNumber}|${dayOfWeek}`;
}

/** Clave del ledger de deduplicación. */
export function sentKey(profileId: string, rule: NoticeRule, periodKey: string): string {
  return `${profileId}|${rule}|${periodKey}`;
}

const dateOnly = (value: string): string => value.slice(0, 10);

/**
 * Clave del recordatorio de agenda: inicio del periodo + la SEMANA de la rejilla.
 *
 * Se agrupa por semana, no por celda, porque una racha contigua de celdas no es
 * contigua para todas las clientas: quien empieza a mitad de la racha la recorre
 * en dos tramos separados (p. ej. con la ventana en W1 mié-jue-vie, quien empieza
 * en viernes la ve el día 1 y otra vez el día 6). Con la clave por celda eso
 * generaba DOS avisos en cinco días para una sola ventana colocada por Aura, en
 * contra del objetivo "un aviso por ventana". Con la clave por semana, ambos
 * tramos comparten clave y sólo se envía el primero.
 *
 * Sigue distinguiendo la ventana de W1 de la de W3 (cadencia quincenal, el uso
 * previsto) y sigue absorbiendo el tope de `week_number` en 4: los días 29-31
 * vuelven a W4 y producen la misma clave.
 *
 * Residuo aceptado: una ventana colocada a caballo entre dos semanas de la
 * rejilla (p. ej. W1 viernes + W2 lunes) cuenta como dos, y dos ventanas
 * distintas dentro de la misma semana cuentan como una. Ninguno de los dos casos
 * corresponde a la cadencia quincenal para la que se diseñó (ver design.md §1).
 */
export function bookingPeriodKey(candidate: NoticeCandidate, now: Date): string {
  const key = getCurrentDayKey(candidate.current_period_start, now);
  return `${dateOnly(candidate.current_period_start)}:W${key.week_number}`;
}

/**
 * Clave del aviso de inactividad: anclada a la última actividad, de forma que
 * se emite un aviso por RACHA de silencio. Si la clienta vuelve a registrar, la
 * fecha avanza y una recaída posterior genera una clave nueva.
 */
export function inactivityPeriodKey(candidate: NoticeCandidate): string {
  return candidate.last_activity_date ?? `never:${dateOnly(candidate.enrollment_date)}`;
}

// --- Detección de la ventana ---------------------------------------------

const DAY_MS = 86_400_000;

const utcDay = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * ¿La celda que ocupa la clienta en `when` expone un bloque "agendar"?
 *
 * ⚠ Trampa del modelo, corregida aquí: `getCurrentDayKey` topa `daysElapsed` en
 * 0 pero toma `day_of_week` del calendario, así que para una fecha ANTERIOR al
 * inicio del periodo devuelve `(W1, día de esa fecha)` — una celda que la
 * clienta aún no ha recorrido (le caerá al final de su semana 1). Preguntar por
 * "ayer" el día 1 devolvía entonces una celda ajena al periodo.
 *
 * Consecuencia real medida: con la ventana recomendada en W1 mié-jue-vie, quien
 * empezaba en jueves o viernes recibía el aviso hasta su día 7 o 6 en vez del
 * día 1. Cualquier fecha previa al inicio del periodo cuenta como "sin bloque".
 */
function hasAgendarBlock(
  candidate: NoticeCandidate,
  cells: Set<string>,
  when: Date
): boolean {
  if (!candidate.series_id) return false;
  if (utcDay(when) < utcDay(new Date(candidate.current_period_start))) return false;
  const key = getCurrentDayKey(candidate.current_period_start, when);
  return cells.has(agendarCellKey(candidate.series_id, key.week_number, key.day_of_week as DayOfWeek));
}

/**
 * ¿Hoy es el PRIMER día de una ventana de agenda para esta clienta?
 *
 * La cadencia la define el contenido: Aura coloca el bloque "agendar" en celdas
 * (semana, día de la semana). El calendario NO se consulta — no hay "día 14".
 * Como cada clienta recorre la misma rejilla desde SU `current_period_start`,
 * la misma celda le cae en un día distinto a cada una, y todas reciben el aviso
 * el primer día de SU ventana.
 */
export function isFirstDayOfAgendarRun(
  candidate: NoticeCandidate,
  cells: Set<string>,
  now: Date
): boolean {
  if (!hasAgendarBlock(candidate, cells, now)) return false;
  const yesterday = new Date(now.getTime() - DAY_MS);
  return !hasAgendarBlock(candidate, cells, yesterday);
}

// --- Plantillas -----------------------------------------------------------

/**
 * Sustituye la lista blanca de placeholders. Un placeholder desconocido se deja
 * literal a propósito: un cron nunca debe romperse porque alguien escribió
 * `{nombre2}` en el editor.
 *
 * ⚠ La lista blanca es una frontera de seguridad, no una comodidad: el cuerpo
 * del mensaje sale de la plataforma por correo (Resend), fuera de nuestra
 * retención de 180 días. Nunca interpolar datos de progreso, salud o cobro.
 */
export function renderTemplate(body: string, fullName: string | null): string {
  const firstName = fullName?.trim().split(/\s+/)[0] ?? "";
  // Reemplazo por FUNCIÓN, no por cadena: `full_name` lo edita la clienta en
  // /portal/settings, y en la forma de cadena `$&`, `$'`, "$`" o `$1` los
  // interpreta el motor de regex. Un nombre como "$`" corrompería el cuerpo que
  // luego se guarda en messages.body y se envía por correo.
  const rendered = body.replace(/\{nombre\}/g, () => firstName);
  if (firstName) return rendered;
  // `profiles.full_name` es NOT NULL, así que esta rama no debería alcanzarse;
  // se mantiene porque un nombre vacío dejaría "Hola :" y eso se leería como un
  // error de la plataforma. Recoge la puntuación y los espacios que dejó el
  // hueco — sin `trim()` global, que se comería los saltos de línea con los que
  // Aura separa los párrafos.
  return rendered.replace(/ +([:,;.!?])/g, "$1").replace(/ {2,}/g, " ");
}

/**
 * Tope de avisos por corrida. Si una regla se evalúa verdadera para una porción
 * implausible del padrón (típicamente un error de fechas), la corrida aborta sin
 * enviar nada.
 *
 * Configurable porque el valor correcto depende del tamaño del padrón: con un
 * tope fijo, crecer lo suficiente hacía que el cron abortara a diario hasta
 * tocar el código. Cualquier valor no numérico, vacío, cero o negativo cae al
 * predeterminado en vez de dejar el envío sin tope.
 */
export const DEFAULT_MAX_NOTICES_PER_RUN = 200;

export function resolveMaxPerRun(raw: string | undefined): number {
  const parsed = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_MAX_NOTICES_PER_RUN;
}

/**
 * Todas las `period_key` que hoy podrían generarse, para acotar la lectura del
 * ledger a lo que de verdad está en evaluación (ver getSentKeys). Es una
 * sobre-aproximación barata: incluye claves de reglas que quizá no se disparen.
 */
export function candidatePeriodKeys(candidates: NoticeCandidate[], now: Date): string[] {
  const keys = new Set<string>();
  for (const c of candidates) {
    keys.add(bookingPeriodKey(c, now));
    keys.add(inactivityPeriodKey(c));
  }
  return Array.from(keys);
}

// --- Evaluación -----------------------------------------------------------

/**
 * Decide qué avisos corresponden hoy. Función pura: recibe los datos ya leídos
 * y devuelve intenciones; no escribe nada. El cron persiste primero la fila del
 * ledger y sólo envía si el insert entró de verdad (insert-before-send: una
 * caída cuesta un mensaje perdido, nunca uno duplicado).
 */
export function evaluateNotices(
  candidates: NoticeCandidate[],
  agendarCells: Set<string>,
  sentKeys: Set<string>,
  templates: NoticeTemplates,
  now: Date
): NoticeIntent[] {
  const intents: NoticeIntent[] = [];
  const todayIso = now.toISOString().split("T")[0];

  for (const c of candidates) {
    // Sin acceso al portal no hay nada que recordar ni a quién reenganchar.
    if (!subscriptionGrantsAccess(c.status)) continue;
    // Quien ya decidió irse no recibe ninguna de las dos reglas: el periodo de
    // gracia no es una oportunidad de reenganche. Pero terminar no es irse: una
    // cliente en su último mes de plazo fijo lleva la misma bandera y SÍ sigue
    // entrenando —es justo el mes en que más vale acompañarla—, así que se
    // distingue por la derivación compartida en vez de por la bandera suelta.
    const finishing = isCompletionScheduled({
      completedAt: c.completed_at,
      cancelAtPeriodEnd: c.cancel_at_period_end,
    });
    if (c.cancel_at_period_end && !finishing) continue;

    const push = (rule: NoticeRule, periodKey: string) => {
      const tpl = templates[rule];
      if (!tpl?.is_active) return;
      if (sentKeys.has(sentKey(c.profile_id, rule, periodKey))) return;
      intents.push({
        profile_id: c.profile_id,
        email: c.email,
        rule,
        period_key: periodKey,
        // El asunto también admite {nombre}: si Aura lo escribe ahí, debe
        // sustituirse igual que en el cuerpo y no llegar literal a la clienta.
        subject: renderTemplate(tpl.subject, c.full_name),
        body: renderTemplate(tpl.body, c.full_name),
      });
    };

    // Regla A — recordatorio de agenda.
    // past_due queda fuera: pedirle agendar mientras le falla el cobro es mal
    // momento, y Stripe ya le está escribiendo por el pago.
    if (c.status !== "past_due" && !c.has_future_call && isFirstDayOfAgendarRun(c, agendarCells, now)) {
      push("booking_reminder", bookingPeriodKey(c, now));
    }

    // Regla B — aviso de inactividad. past_due sí lo recibe: sigue teniendo
    // acceso al portal y es justo cuando conviene reenganchar.
    if (isInactive(c.last_activity_date, todayIso, INACTIVITY_THRESHOLD_DAYS)) {
      push("inactivity_nudge", inactivityPeriodKey(c));
    }
  }

  return intents;
}
