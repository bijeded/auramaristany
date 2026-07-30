import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logAndGeneric } from "./errors";
import type { CancellationReason, SubscriptionStatus } from "@/lib/supabase/types";
import type {
  ChurnSubRow,
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

/**
 * Todas las suscripciones que alguna vez existieron, con su variante y su
 * estado — la materia prima de "Cancelaciones por variante".
 *
 * SIN filtro de estado, y eso es lo que hay que no "arreglar": el numerador y
 * el denominador de la tasa salen los dos de este mismo conjunto, y el reparto
 * lo hace `groupChurnByVariant`, que está probado. Filtrar por `canceled` aquí
 * dejaría a la carta sin denominador; filtrar por cualquier otra cosa movería
 * una definición que vive en la spec a un lugar que ninguna prueba mira.
 *
 * Lee `subscriptions` y no `cancellation_surveys` a propósito: la variante es
 * columna directa de esta tabla, así que la población está completa —cuenta a
 * quien se fue haya contestado la encuesta o no—, mientras que
 * `cancellation_surveys.subscription_id` es `on delete set null` y pierde la
 * variante en cuanto se borra un cliente.
 */
export async function getChurnByVariantAllTime(): Promise<ChurnSubRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    // `!program_variant_id` otra vez: dos FKs hacia program_variants y sin
    // desambiguar PostgREST devuelve un error, no filas (regla 9).
    .select("status, program_variants!program_variant_id(name)");

  // Se lee `error`, no sólo `data`: el modo de falla de la regla 9 es un error,
  // no un resultado vacío, y mirando sólo `data` una regresión del embed se
  // vería como "nadie se ha ido nunca" — la tarjeta más tranquilizadora posible
  // y ni una línea en el log.
  if (error) {
    logAndGeneric("getChurnByVariantAllTime", error);
    return [];
  }

  // keep: subscriptions JOIN program_variants — nested join shape not inferred by SDK.
  type Raw = {
    status: SubscriptionStatus;
    program_variants: { name: string } | null;
  };
  return ((data ?? []) as Raw[]).map((r) => ({
    status: r.status,
    // Etiqueta y no "—": una suscripción sin variante lleva barra propia, y un
    // guion se lee como el nombre de una variante.
    variant_name: r.program_variants?.name ?? "Sin variante",
  }));
}

/**
 * Motivos de baja, histórico completo — la materia prima de "Razones de
 * cancelación".
 *
 * Sin join: la carta agrupa por motivo y nada más. Y SIN leer `detail`, que es
 * texto libre del cliente: un agregado no tiene dónde ponerlo, enseñar
 * respuestas sueltas en un dashboard sería exhibir las palabras de una persona
 * como si fueran una estadística, y la columna puede traer texto con forma de
 * HTML (regla 18) — no traerla es no tener que cuidarla.
 *
 * Cliente RLS-aware, sin service-role: la migración 011 ya le da `select` al
 * admin vía `is_admin()`, y la ruta entra por `requireAdminPage()`.
 */
export async function getCancellationReasonsAllTime(): Promise<{ reason: CancellationReason }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cancellation_surveys").select("reason");

  if (error) {
    logAndGeneric("getCancellationReasonsAllTime", error);
    return [];
  }

  return (data ?? []) as { reason: CancellationReason }[];
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
