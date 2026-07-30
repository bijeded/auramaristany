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
   * llama con el valor real y no con una suposición sobre el filtro. Si algún día
   * se ensancha la consulta, las filas nuevas caen en el balde que les toque
   * —incluido `excluded`— en vez de desaparecer sin que nadie lo note.
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
  /**
   * Ni cobra ni está terminando: ya terminó. Hoy siempre vacío —la consulta
   * filtra por `active`—, y existe justo para que eso no haga falta creerlo: sin
   * este balde, ensanchar la consulta dejaría caer filas de las tres cohortes en
   * silencio mientras el headcount seguía contándolas, que es exactamente la
   * divergencia callada que este cambio viene a quitar. La suma de los cuatro es
   * el total de entrada SIEMPRE, no sólo mientras el filtro coopere.
   */
  excluded: FinanceSubRow[];
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
  const out: OutcomePartition = { billing: [], completing: [], cancelling: [], excluded: [] };
  for (const row of rows) {
    const { kind } = deriveCancellationState({
      status: row.status,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      completedAt: row.completed_at,
    });
    if (kind === "completing") out.completing.push(row);
    else if (kind === "grace") out.cancelling.push(row);
    else if (kind === "eligible") out.billing.push(row);
    else out.excluded.push(row); // `completed` | `none` — ya terminaron.
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

/**
 * Fila de invoice para la tarjeta "Ingresos por variante".
 *
 * Deliberadamente SIN `invoice_date`: esa cifra es histórica completa, sin
 * ventana, así que la fecha no participa. `FinanceInvoiceRow` (que sí la lleva)
 * es de la ventana de 12 meses de "Ingresos por mes" y no debe reutilizarse
 * aquí — compartir el tipo invitaría a compartir la consulta, y ésa es
 * justamente la que no puede cambiar de significado.
 */
export interface FinanceVariantInvoiceRow {
  amount_paid: number;       // en pesos
  variant_name: string;
}

export interface MonthRevenue { key: string; label: string; total: number }
export interface VariantCount { variant: string; count: number }
export interface VariantRevenue { variant: string; total: number }

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
// dashboard-revenue-by-variant: groupRevenueByVariant + orderRevenueByClientsOrder
// ---------------------------------------------------------------------------

/**
 * Ingreso histórico por variante. Cifra de DINERO (ADR 0004): cuenta lo que se
 * cobró, sin importar si la suscripción que lo produjo sigue viva. Su tarjeta
 * vecina, "Clientes por variante", es cifra de PERSONAS y cuenta acceso actual;
 * que las dos discrepen es intencional, no un desajuste que haya que cuadrar.
 */
export function groupRevenueByVariant(invoices: FinanceVariantInvoiceRow[]): VariantRevenue[] {
  const totals = new Map<string, number>();
  for (const inv of invoices) totals.set(inv.variant_name, (totals.get(inv.variant_name) ?? 0) + inv.amount_paid);
  return Array.from(totals.entries())
    .map(([variant, total]) => ({ variant, total }))
    // Una variante que suma 0 no es "ingreso cero": es una fila con una barra
    // invisible. La tarjeta lista sólo lo que tiene ingreso.
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Ordena el ingreso siguiendo el orden de la tarjeta de clientes, y agrega al
 * final las variantes que sólo existen del lado del dinero (clientes ya
 * terminados, ingreso histórico vivo) por total descendente.
 *
 * El orden compartido es lo que hace legible la comparación entre las dos
 * tarjetas: ordenarlas por separado, cada una por su propia medida, produce dos
 * listas que comparten etiquetas y sugieren una correspondencia fila-a-fila que
 * no existe. La alineación vale arriba, donde está el traslape, y se pierde
 * abajo — a propósito.
 */
export function orderRevenueByClientsOrder(
  revenue: VariantRevenue[],
  clientsOrder: VariantCount[]
): VariantRevenue[] {
  const byVariant = new Map(revenue.map((r) => [r.variant, r]));
  const shared: VariantRevenue[] = [];

  for (const c of clientsOrder) {
    const row = byVariant.get(c.variant);
    if (!row) continue;   // tiene clientes pero aún no factura: no va en esta tarjeta
    shared.push(row);
    byVariant.delete(c.variant);
  }

  const revenueOnly = Array.from(byVariant.values()).sort((a, b) => b.total - a.total);
  return [...shared, ...revenueOnly];
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
