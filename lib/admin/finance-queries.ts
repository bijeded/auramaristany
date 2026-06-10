import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  FinanceSubRow,
  FinanceInvoiceRow,
  RecentPaymentRow,
} from "./finance-helpers";

export async function getActiveSubscriptions(): Promise<FinanceSubRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("current_period_end, program_variants(price_mxn, programs(name))")
    .eq("status", "active");

  type Raw = {
    current_period_end: string | null;
    program_variants: { price_mxn: number; programs: { name: string } | null } | null;
  };
  return ((data ?? []) as unknown as Raw[])
    .filter((r) => r.program_variants)
    .map((r) => ({
      current_period_end: r.current_period_end,
      price_mxn: r.program_variants!.price_mxn,
      program_name: r.program_variants!.programs?.name ?? "—",
    }));
}

export async function getPaidInvoices(monthsBack = 12): Promise<FinanceInvoiceRow[]> {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const { data } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, subscriptions(program_variants(programs(name)))")
    .eq("status", "paid")
    .gte("invoice_date", cutoff.toISOString());

  type Raw = {
    amount_paid: number;
    invoice_date: string;
    subscriptions: { program_variants: { programs: { name: string } | null } | null } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    amount_paid: r.amount_paid,
    invoice_date: r.invoice_date,
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
  }));
}

export async function getPastDueCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "past_due");
  return count ?? 0;
}

export async function getRecentPayments(limit = 10): Promise<RecentPaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, status, subscriptions(profiles(full_name), program_variants(programs(name)))")
    .order("invoice_date", { ascending: false })
    .limit(limit);

  type Raw = {
    amount_paid: number;
    invoice_date: string;
    status: string;
    subscriptions: {
      profiles: { full_name: string | null } | null;
      program_variants: { programs: { name: string } | null } | null;
    } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    invoice_date: r.invoice_date,
    client_name: r.subscriptions?.profiles?.full_name ?? "—",
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
    amount_paid: r.amount_paid,
    status: r.status,
  }));
}
