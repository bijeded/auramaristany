import { contentProgressLabel } from "@/lib/portal/progress-display";
import { isCompletionScheduled } from "@/lib/portal/cancellation";
import { dayLabel } from "@/lib/admin/date-helpers";
import { formatMXN } from "@/lib/admin/finance-helpers";

/**
 * La celda de cobro de una suscripción, para el listado Y para la ficha.
 *
 * Existe porque estaban duplicadas: la ficha aprendió que una suscripción
 * terminada ya no cobra y la tabla no, así que el listado le anunciaba a Aura un
 * "Próximo cobro" de una cliente cuya suscripción llevaba días cancelada en
 * Stripe. Nada que tenga fecha de final vuelve a cobrar —ni la terminada, ni la
 * que está terminando, ni la que se dio de baja y agota su periodo—, así que la
 * pregunta se contesta UNA vez.
 */
export function nextChargeCell(sub: {
  status: string;
  completed_at?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end: string | null;
  price_mxn: number;
}): { label: string; value: string } {
  const ending =
    sub.status === "completed" ||
    sub.cancel_at_period_end === true ||
    isCompletionScheduled({
      completedAt: sub.completed_at,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    });

  if (!sub.current_period_end) {
    return { label: ending ? "Acceso termina el" : "Próximo cobro", value: "—" };
  }
  const date = dayLabel(sub.current_period_end.slice(0, 10));
  return ending
    ? { label: "Acceso termina el", value: date }
    : { label: "Próximo cobro", value: `${date} · ${formatMXN(sub.price_mxn)}` };
}

export type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "completed";

export type StatusFilter = "Activas" | "Vencidas" | "Canceladas" | "Completadas" | "Sin actividad" | null;

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
  /** Las dos señales del final; sin ellas la tabla anunciaba cobros que no existen. */
  completed_at: string | null;
  cancel_at_period_end: boolean;
  last_activity_date: string | null; // max progress_logs.log_date (YYYY-MM-DD) o null
}

/**
 * Días completos transcurridos entre dos fechas date-only, en UTC (evita desfase
 * de zona horaria — lección EDGE-3). Ignora la parte de hora si viene un ISO completo.
 */
function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toISO.slice(0, 10)}T00:00:00Z`);
  return Math.floor((to - from) / 86_400_000);
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
  const DEAD: readonly SubStatus[] = ["canceled", "completed"];
  const live = subs.some((s) => !DEAD.includes(s.status));
  if (live) {
    return { ok: false, reason: "Tiene una suscripción activa. Cancélala en Stripe antes de eliminar." };
  }
  return { ok: true };
}

const STATUS_ES: Record<SubStatus, string> = {
  active: "Activa",
  trialing: "Prueba",
  past_due: "Pago fallido",
  unpaid: "Impaga",
  canceled: "Cancelada",
  completed: "Completada",
};

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function clientsToCSV(rows: ClientListRow[]): string {
  const header = "Nombre,Email,Programa,Variante,Estado,Inscripción";
  const lines = rows.map((r) =>
    [r.full_name, r.email, r.program_name, r.variant_name, STATUS_ES[r.status], r.enrollment_date]
      .map(csvCell)
      .join(",")
  );
  return [header, ...lines].join("\n");
}
