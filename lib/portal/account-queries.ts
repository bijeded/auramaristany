import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  PORTAL_SHELL_STATES,
  subscriptionGrantsAccess,
} from "@/lib/content/subscription-access";
import {
  contentProgressLabel,
  type ContentProgress,
} from "@/lib/portal/progress-display";

export type AccountSubscription = {
  program_name: string;
  variant_name: string;
  status: string;
  cancel_at_period_end: boolean;
  enrollment_date: string;
  current_period_end: string | null;
  price_mxn: number;
  months_elapsed: number;
  duration_months: number | null;
  billing_model: string;
  /** Puntero de contenido: dónde entrena, que puede no ser lo que compró. */
  content_variant_id: string | null;
  content_ordinal: number;
  content_loops: number;
  /** Nombre de la variante del puntero; se resuelve aparte del join. */
  rung_name: string | null;
  /** Nivel de esa misma variante; decide a qué peldaño de Extra apunta el CTA. */
  rung_level: string | null;
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
  cancel_at_period_end: boolean | null;
  enrollment_date: string;
  current_period_end: string | null;
  months_elapsed: number;
  content_variant_id: string | null;
  content_ordinal: number;
  content_loops: number;
  program_variants: { name: string; price_mxn: number; programs: { name: string; duration_months: number | null; billing_model: string } | null } | null;
};

export function mapSubscription(rows: RawSub[] | null): AccountSubscription | null {
  const usable = (rows ?? []).filter((x) => x.program_variants);
  // La ficha lee también las terminadas —es donde vive el CTA para seguir con
  // Extra—, así que pueden convivir dos filas. La que paga manda: enseñar
  // "Programa completado" a quien acaba de comprar Extra sería mentirle.
  const r = usable.find((x) => subscriptionGrantsAccess(x.status)) ?? usable[0];
  if (!r || !r.program_variants) return null;
  return {
    program_name: r.program_variants.programs?.name ?? "—",
    variant_name: r.program_variants.name,
    status: r.status,
    cancel_at_period_end: r.cancel_at_period_end ?? false,
    enrollment_date: r.enrollment_date,
    current_period_end: r.current_period_end,
    price_mxn: r.program_variants.price_mxn,
    months_elapsed: r.months_elapsed,
    duration_months: r.program_variants.programs?.duration_months ?? null,
    billing_model: r.program_variants.programs?.billing_model ?? "rolling_monthly",
    content_variant_id: r.content_variant_id,
    content_ordinal: r.content_ordinal,
    content_loops: r.content_loops,
    rung_name: null,
    rung_level: null,
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

/**
 * La etiqueta de progreso de la ficha de suscripción.
 *
 * Delega en el helper compartido para que el portal, la ficha y el admin digan
 * lo mismo: fracción en plazo fijo, peldaño + posición en rolling.
 */
export function accountProgressLabel(sub: AccountSubscription): ContentProgress {
  return contentProgressLabel({
    billingModel: sub.billing_model,
    durationMonths: sub.duration_months,
    monthsElapsed: sub.months_elapsed,
    rungName: sub.rung_name,
    contentOrdinal: sub.content_ordinal,
    contentLoops: sub.content_loops,
    status: sub.status,
  });
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
    .select("status, cancel_at_period_end, enrollment_date, current_period_end, months_elapsed, content_variant_id, content_ordinal, content_loops, program_variants!program_variant_id(name, price_mxn, programs(name, duration_months, billing_model))")
    .eq("profile_id", userId)
    // L2c — incluye las terminadas: esta pantalla es el aterrizaje de la
    // clienta graduada y tiene que poder contarle que su programa acabó.
    .in("status", PORTAL_SHELL_STATES)
    .order("enrollment_date", { ascending: false });

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, status, subscriptions(program_variants!program_variant_id(programs(name)))")
    .order("invoice_date", { ascending: false });

  // keep: subscriptions JOIN program_variants JOIN programs — nested join shape not inferred.
  const subscription = mapSubscription(subRows as RawSub[] | null);
  // El nombre del peldaño se pide aparte: el join de arriba cuelga de
  // `program_variant_id` (lo que compró) y el puntero puede apuntar a otra.
  if (subscription?.content_variant_id) {
    const { data: rungRow } = await supabase
      .from("program_variants")
      .select("name, level")
      .eq("id", subscription.content_variant_id)
      .maybeSingle();
    const rung = rungRow as { name: string; level: string | null } | null;
    subscription.rung_name = rung?.name ?? null;
    subscription.rung_level = rung?.level ?? null;
  }

  const p = (profileRow ?? {}) as { full_name?: string; email?: string; phone?: string | null; avatar_url?: string | null };
  return {
    profile: {
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? null,
      avatar_url: p.avatar_url ?? null,
    },
    subscription,
    // keep: invoices JOIN subscriptions JOIN program_variants JOIN programs — nested join not inferred.
    invoices: mapInvoices(invoiceRows as RawInvoice[] | null),
  };
}
