export type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid";

export type StatusFilter = "Activas" | "Vencidas" | "Canceladas" | "Sin actividad" | null;

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

export function subscriptionProgressLabel(
  sub: { months_elapsed: number },
  program: { billing_model: string; duration_months: number | null }
): string {
  if (program.billing_model === "fixed_term_monthly" && program.duration_months) {
    return `Mes ${sub.months_elapsed} de ${program.duration_months}`;
  }
  return `Mes ${sub.months_elapsed}`;
}

export function canDeleteClient(
  subs: { status: SubStatus }[]
): { ok: boolean; reason?: string } {
  const live = subs.some((s) => s.status !== "canceled");
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
