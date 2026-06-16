import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ACCESS_STATES } from "@/lib/content/subscription-access";

export type AccountSubscription = {
  program_name: string;
  variant_name: string;
  status: string;
  enrollment_date: string;
  current_period_end: string | null;
  price_mxn: number;
  months_elapsed: number;
  duration_months: number | null;
};

export type AccountInvoice = {
  invoice_date: string;
  program_name: string;
  amount_paid: number;
  status: string;
};

export type AccountData = {
  profile: { full_name: string; email: string; phone: string | null; avatar_url: string | null };
  subscription: AccountSubscription | null;
  invoices: AccountInvoice[];
};

type RawSub = {
  status: string;
  enrollment_date: string;
  current_period_end: string | null;
  months_elapsed: number;
  program_variants: { name: string; price_mxn: number; programs: { name: string; duration_months: number | null } | null } | null;
};

export function mapSubscription(rows: RawSub[] | null): AccountSubscription | null {
  const r = (rows ?? []).find((x) => x.program_variants);
  if (!r || !r.program_variants) return null;
  return {
    program_name: r.program_variants.programs?.name ?? "—",
    variant_name: r.program_variants.name,
    status: r.status,
    enrollment_date: r.enrollment_date,
    current_period_end: r.current_period_end,
    price_mxn: r.program_variants.price_mxn,
    months_elapsed: r.months_elapsed,
    duration_months: r.program_variants.programs?.duration_months ?? null,
  };
}

type RawInvoice = {
  amount_paid: number;
  invoice_date: string;
  status: string;
  subscriptions: { program_variants: { programs: { name: string } | null } | null } | null;
};

export function mapInvoices(rows: RawInvoice[] | null): AccountInvoice[] {
  return (rows ?? []).map((r) => ({
    amount_paid: r.amount_paid,
    invoice_date: r.invoice_date,
    status: r.status,
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
  }));
}

export function progressLabel(monthsElapsed: number, durationMonths: number | null): { text: string; percent: number } | null {
  if (!durationMonths || durationMonths <= 0) return null;
  const percent = Math.min(100, Math.round((monthsElapsed / durationMonths) * 100));
  return { text: `Mes ${monthsElapsed} de ${durationMonths}`, percent };
}

export async function getAccountData(userId: string): Promise<AccountData> {
  const supabase = await createClient();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, email, phone, avatar_url")
    .eq("id", userId)
    .single();

  const { data: subRows } = await supabase
    .from("subscriptions")
    .select("status, enrollment_date, current_period_end, months_elapsed, program_variants(name, price_mxn, programs(name, duration_months))")
    .eq("profile_id", userId)
    .in("status", ACCESS_STATES)
    .order("enrollment_date", { ascending: false });

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, status, subscriptions(program_variants(programs(name)))")
    .order("invoice_date", { ascending: false });

  const p = (profileRow ?? {}) as { full_name?: string; email?: string; phone?: string | null; avatar_url?: string | null };
  return {
    profile: {
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? null,
      avatar_url: p.avatar_url ?? null,
    },
    // keep: subscriptions JOIN program_variants JOIN programs — nested join shape not inferred.
    subscription: mapSubscription(subRows as RawSub[] | null),
    // keep: invoices JOIN subscriptions JOIN program_variants JOIN programs — nested join not inferred.
    invoices: mapInvoices(invoiceRows as RawInvoice[] | null),
  };
}
