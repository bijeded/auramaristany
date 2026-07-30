import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logAndGeneric } from "./errors";
import type { SubscriptionStatus } from "@/lib/supabase/types";
import type {
  FinanceSubRow,
  FinanceInvoiceRow,
  FinanceVariantInvoiceRow,
  RecentPaymentRow,
  PaymentRow,
} from "./finance-helpers";

export async function getActiveSubscriptions(): Promise<FinanceSubRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "current_period_end, status, cancel_at_period_end, completed_at, program_variants!program_variant_id(name, price_mxn)"
    )
    // D17 — `active` y sólo `active`, POR DECISIÓN, no por descuido: así toda
    // cifra financiera es conservadora. Una `trialing` todavía no ha pagado y
    // una `past_due` ya falló, y ninguna de las dos debe sumar al MRR ni a la
    // proyección; `past_due` sale por su cuenta en "Requieren atención".
    // No lo "arregles" ensanchándolo sin cambiar la spec.
    .eq("status", "active");

  // keep: subscriptions JOIN program_variants — nested join shape not inferred by SDK.
  type Raw = {
    current_period_end: string | null;
    status: SubscriptionStatus;
    cancel_at_period_end: boolean | null;
    completed_at: string | null;
    program_variants: { name: string; price_mxn: number } | null;
  };
  return ((data ?? []) as Raw[])
    .filter((r) => r.program_variants)
    .map((r) => ({
      current_period_end: r.current_period_end,
      price_mxn: r.program_variants!.price_mxn,
      variant_name: r.program_variants!.name,
      status: r.status,
      cancel_at_period_end: r.cancel_at_period_end ?? false,
      completed_at: r.completed_at,
    }));
}

export async function getPaidInvoices(monthsBack = 12): Promise<FinanceInvoiceRow[]> {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const { data } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, subscriptions(program_variants!program_variant_id(programs(name)))")
    .eq("status", "paid")
    .gte("invoice_date", cutoff.toISOString());

  // keep: invoices JOIN subscriptions JOIN program_variants JOIN programs — nested join not inferred.
  type Raw = {
    amount_paid: number;
    invoice_date: string;
    subscriptions: { program_variants: { programs: { name: string } | null } | null } | null;
  };
  return ((data ?? []) as Raw[]).map((r) => ({
    amount_paid: r.amount_paid,
    invoice_date: r.invoice_date,
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
  }));
}

/**
 * Ingreso histórico por variante — TODA la vida del negocio, sin corte de fecha.
 *
 * Consulta aparte y no un `getPaidInvoices(null)`: esa función tiene un solo
 * consumidor ("Ingresos por mes") que necesita exactamente 12 meses, y volver
 * opcional su ventana le daría dos significados a la misma función y dos
 * llamadas que jamás deben separarse. Una cifra de dinero declara su alcance
 * (regla 14); un corte nullable lo esconde.
 *
 * Se agrega en memoria y no con una función de Postgres a propósito: un RPC
 * obligaría a poblar `Database["public"]["Functions"]`, que la regla 10 prohíbe
 * — cambia la resolución de embeds de PostgREST al `Relationships: []` que se
 * mantiene a mano y rompe `tsc` en TODOS los joins del repo. Revisar si el
 * volumen de invoices llega a hacer medible el viaje de ida y vuelta; queda
 * aislado detrás de esta función, así que el cambio sería local.
 */
export async function getRevenueByVariantAllTime(): Promise<FinanceVariantInvoiceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    // OJO — `!program_variant_id` NO es decorativo: subscriptions tiene dos FKs
    // hacia program_variants y sin desambiguar PostgREST devuelve un error, no
    // filas (regla 9).
    .select("amount_paid, subscriptions(program_variants!program_variant_id(name))")
    .eq("status", "paid");

  // Por eso se lee `error` y no sólo `data`: el modo de falla de la regla 9 es
  // un error de PostgREST, no un resultado vacío. Mirando sólo `data`, una
  // regresión del embed se vería como "todavía no hay ingresos" — la tarjeta en
  // blanco y ni una línea en el log.
  if (error) {
    logAndGeneric("getRevenueByVariantAllTime", error);
    return [];
  }

  // keep: invoices JOIN subscriptions JOIN program_variants — nested join not inferred.
  type Raw = {
    amount_paid: number;
    subscriptions: { program_variants: { name: string } | null } | null;
  };
  return ((data ?? []) as Raw[]).map((r) => ({
    amount_paid: r.amount_paid,
    // Etiqueta y no "—": esta fila lleva barra propia y agrupa las invoices
    // huérfanas. Un guion se lee como el nombre de una variante.
    variant_name: r.subscriptions?.program_variants?.name ?? "Sin variante",
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
    .select("amount_paid, invoice_date, status, subscriptions(profiles(full_name), program_variants!program_variant_id(programs(name)))")
    .order("invoice_date", { ascending: false })
    .limit(limit);

  // keep: invoices JOIN subscriptions JOIN profiles JOIN program_variants JOIN programs — nested join not inferred.
  type Raw = {
    amount_paid: number;
    invoice_date: string;
    status: string;
    subscriptions: {
      profiles: { full_name: string | null } | null;
      program_variants: { programs: { name: string } | null } | null;
    } | null;
  };
  return ((data ?? []) as Raw[]).map((r) => ({
    invoice_date: r.invoice_date,
    client_name: r.subscriptions?.profiles?.full_name ?? "—",
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
    amount_paid: r.amount_paid,
    status: r.status,
  }));
}

export async function getAllPayments(): Promise<PaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(
      "amount_paid, invoice_date, status, subscriptions(profile_id, profiles(full_name), program_variants!program_variant_id(name, programs(name)))"
    )
    .order("invoice_date", { ascending: false });

  // keep: invoices JOIN subscriptions JOIN profiles JOIN program_variants JOIN programs — nested join not inferred.
  type Raw = {
    amount_paid: number;
    invoice_date: string;
    status: string;
    subscriptions: {
      profile_id: string;
      profiles: { full_name: string | null } | null;
      program_variants: { name: string; programs: { name: string } | null } | null;
    } | null;
  };
  return ((data ?? []) as Raw[]).map((r) => ({
    invoice_date: r.invoice_date,
    profile_id: r.subscriptions?.profile_id ?? null,
    client_name: r.subscriptions?.profiles?.full_name ?? "—",
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
    variant_name: r.subscriptions?.program_variants?.name ?? "—",
    amount_paid: r.amount_paid,
    status: r.status,
  }));
}
