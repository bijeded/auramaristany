import { deriveCancellationState } from "@/lib/portal/cancellation";
import type { SubscriptionStatus } from "@/lib/supabase/types";

export interface FinanceSubRow {
  current_period_end: string | null; // ISO
  price_mxn: number;
  variant_name: string;
  /**
   * D17 — las tres señales del ciclo de vida. Sin ellas el dashboard no podía
   * distinguir una suscripción que renueva de una que se está acabando, y le
   * sumaba a Aura dinero que no va a llegar.
   *
   * `status` viaja aunque hoy la consulta filtre por `active`: la derivación se
   * llama con el valor real, no con una suposición sobre el filtro, así que si
   * algún día se ensancha la consulta la respuesta sigue siendo correcta en vez
   * de quedarse callada y mal.
   */
  status: SubscriptionStatus;
  cancel_at_period_end: boolean;
  completed_at: string | null;
}

/** Las tres cohortes en que se reparte una suscripción activa. */
export interface OutcomePartition {
  /** Vuelve a cobrar: alimenta el MRR y "Renuevan". */
  billing: FinanceSubRow[];
  /** Último mes ya pagado de un plazo fijo — se gradúa, no se va. */
  completing: FinanceSubRow[];
  /** Baja voluntaria agotando su periodo. */
  cancelling: FinanceSubRow[];
}

/**
 * Reparte las suscripciones activas en las tres cohortes, en UNA pasada.
 *
 * No decide nada por su cuenta: le pregunta a `deriveCancellationState`, la
 * misma función que usa el portal y el listado de clientes. Ésa es la razón de
 * que exista — "¿esta suscripción se está acabando?" vive repartida entre
 * `status`, `completed_at` y `cancel_at_period_end`, y cada lector que se lo
 * deduzca por su cuenta se equivoca en un subconjunto distinto (L2c lo cazó
 * tres veces, y una cuarta llegó a producción). El orden también importa: la
 * bandera hay que mirarla DESPUÉS de la completion, porque quien se gradúa la
 * trae puesta igual; eso ya está resuelto dentro de la derivación.
 *
 * Una pasada y un solo balde por fila hacen que el invariante del dashboard
 * —las tres tarjetas reparten la ventana sin solaparse— sea cierto por
 * construcción, no por que quien las escriba se acuerde.
 */
export function partitionByOutcome(rows: FinanceSubRow[]): OutcomePartition {
  const out: OutcomePartition = { billing: [], completing: [], cancelling: [] };
  for (const row of rows) {
    const { kind } = deriveCancellationState({
      status: row.status,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      completedAt: row.completed_at,
    });
    if (kind === "completing") out.completing.push(row);
    else if (kind === "grace") out.cancelling.push(row);
    else if (kind === "eligible") out.billing.push(row);
    // `completed` y `none` no son alcanzables mientras la consulta filtre por
    // `active`; si lo fueran, quedarse fuera de las tres es lo correcto: no
    // cobran y no están terminando, ya terminaron.
  }
  return out;
}

export interface FinanceInvoiceRow {
  amount_paid: number;       // en pesos
  invoice_date: string;      // ISO
  program_name: string;
}

export interface RecentPaymentRow {
  invoice_date: string;      // ISO
  client_name: string;
  program_name: string;
  amount_paid: number;
  status: string;            // 'paid' | 'open' | 'void' | 'uncollectible'
}

export interface MonthRevenue { key: string; label: string; total: number }
export interface VariantCount { variant: string; count: number }
export interface ProgramRevenue { program: string; total: number }

// ---------------------------------------------------------------------------
// Task 1: formatMXN
// ---------------------------------------------------------------------------

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  currencyDisplay: "narrowSymbol", // always "$" regardless of ICU build (avoids "MXN"/"MX$" drift)
  maximumFractionDigits: 0,
});

export function formatMXN(n: number): string {
  return MXN.format(Math.round(n));
}

// ---------------------------------------------------------------------------
// Task 2: computeMRR
// ---------------------------------------------------------------------------

export function computeMRR(subs: { price_mxn: number }[]): number {
  return subs.reduce((sum, s) => sum + s.price_mxn, 0);
}

// ---------------------------------------------------------------------------
// Task 3: groupRevenueByMonth
// ---------------------------------------------------------------------------

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function groupRevenueByMonth(
  invoices: FinanceInvoiceRow[],
  monthsBack = 12,
  now: Date = new Date()
): MonthRevenue[] {
  const buckets: MonthRevenue[] = [];
  const index = new Map<string, MonthRevenue>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    const label = d.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }).replace(".", "");
    const bucket = { key, label, total: 0 };
    buckets.push(bucket);
    index.set(key, bucket);
  }
  for (const inv of invoices) {
    const bucket = index.get(monthKey(new Date(inv.invoice_date)));
    if (bucket) bucket.total += inv.amount_paid;
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Task 4: groupClientsByVariant
// ---------------------------------------------------------------------------

export function groupClientsByVariant(subs: { variant_name: string }[]): VariantCount[] {
  const counts = new Map<string, number>();
  for (const s of subs) counts.set(s.variant_name, (counts.get(s.variant_name) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([variant, count]) => ({ variant, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Task 5: groupRevenueByProgram
// ---------------------------------------------------------------------------

export function groupRevenueByProgram(invoices: FinanceInvoiceRow[]): ProgramRevenue[] {
  const totals = new Map<string, number>();
  for (const inv of invoices) totals.set(inv.program_name, (totals.get(inv.program_name) ?? 0) + inv.amount_paid);
  return Array.from(totals.entries())
    .map(([program, total]) => ({ program, total }))
    .sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// Task 6 / D17: computeRenewalsWithinDays
// ---------------------------------------------------------------------------

export function computeRenewalsWithinDays(
  subs: { current_period_end: string | null; price_mxn: number }[],
  days: number,
  now: Date = new Date()
): { count: number; amount: number } {
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  let count = 0;
  let amount = 0;
  for (const s of subs) {
    if (!s.current_period_end) continue;
    const end = new Date(s.current_period_end);
    if (end >= now && end <= horizon) {
      count += 1;
      amount += s.price_mxn;
    }
  }
  return { count, amount };
}

// ---------------------------------------------------------------------------
// Task 3 (payments): PaymentRow + filterPaymentsByStatus
// ---------------------------------------------------------------------------

export interface PaymentRow {
  invoice_date: string;          // ISO (timestamptz)
  profile_id: string | null;
  client_name: string;
  program_name: string;
  variant_name: string;
  amount_paid: number;           // en pesos
  status: string;                // 'paid' | 'open' | 'void' | 'uncollectible'
}

export type PaymentStatusFilter = "todos" | "paid" | "open" | "void" | "uncollectible";

export function filterPaymentsByStatus(
  rows: PaymentRow[],
  status: PaymentStatusFilter
): PaymentRow[] {
  if (status === "todos") return rows;
  return rows.filter((r) => r.status === status);
}
