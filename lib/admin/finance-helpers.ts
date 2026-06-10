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
  maximumFractionDigits: 0,
});

export function formatMXN(n: number): string {
  // Intl uses "MX$" in some environments; normalize to "$" used in the prototype.
  return MXN.format(Math.round(n)).replace(/^MX\$/, "$");
}
