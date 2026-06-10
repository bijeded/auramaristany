export interface FinanceSubRow {
  current_period_end: string | null; // ISO
  price_mxn: number;
  program_name: string;
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
export interface ProgramCount { program: string; count: number }
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
// Task 4: groupClientsByProgram
// ---------------------------------------------------------------------------

export function groupClientsByProgram(subs: { program_name: string }[]): ProgramCount[] {
  const counts = new Map<string, number>();
  for (const s of subs) counts.set(s.program_name, (counts.get(s.program_name) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([program, count]) => ({ program, count }))
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
// Task 6: computeRenewalsThisMonth
// ---------------------------------------------------------------------------

export function computeRenewalsThisMonth(
  subs: { current_period_end: string | null; price_mxn: number }[],
  now: Date = new Date()
): { count: number; amount: number } {
  const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
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
