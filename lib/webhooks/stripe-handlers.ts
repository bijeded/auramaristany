import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";
import {
  advanceLadderPosition,
  resolveContentPosition,
  type LadderPosition,
} from "@/lib/content/ladder";
import { firstOrdinal, type CurriculumEntry } from "@/lib/content/curriculum";
import {
  sendWelcomeEmail,
  sendPaymentFailedEmail,
  sendSubscriptionEndedEmail,
} from "@/lib/email/send";

// Stripe API 2026+ moved the billing period onto subscription items.
// The SubscriptionItem SDK type may not yet expose these fields, so read them defensively.
type ItemPeriod = { current_period_start?: number; current_period_end?: number };

function readPeriod(subscription: Stripe.Subscription) {
  // keep: Stripe SDK SubscriptionItem type doesn't expose current_period_* in TypeScript
  // definitions (moved to item level in 2026+ API); reading defensively via local interface.
  const item = subscription.items.data[0] as ItemPeriod | undefined;
  return {
    current_period_start: item?.current_period_start
      ? new Date(item.current_period_start * 1000).toISOString()
      : new Date().toISOString(),
    current_period_end: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
  };
}

// Pure function — testable without DB
export function computeMonthsUpdate(
  currentMonthsElapsed: number,
  billingModel: string,
  durationMonths: number | null
): { newMonthsElapsed: number; shouldComplete: boolean } {
  const newMonthsElapsed = currentMonthsElapsed + 1;
  const shouldComplete =
    billingModel === "fixed_term_monthly" &&
    durationMonths !== null &&
    newMonthsElapsed >= durationMonths;
  return { newMonthsElapsed, shouldComplete };
}

type ServiceClient = ReturnType<typeof createServiceClient>;

async function getProfileContact(supabase: ServiceClient, profileId: string): Promise<{ email: string; name: string } | null> {
  const { data } = await supabase.from("profiles").select("email, full_name").eq("id", profileId).single();
  if (!data?.email) return null;
  return { email: data.email, name: data.full_name ?? "" };
}

async function getContactBySubscription(supabase: ServiceClient, stripeSubscriptionId: string): Promise<{ email: string; name: string } | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("profiles(email, full_name)")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .single();
  // keep: subscriptions JOIN profiles — nested join shape not inferred by SDK without Relationships.
  type SubProfile = { profiles: { email: string; full_name: string | null } | null };
  const p = (data as SubProfile | null)?.profiles;
  if (!p?.email) return null;
  return { email: p.email, name: p.full_name ?? "" };
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createServiceClient();
  const { supabase_user_id, variant_id } = session.metadata ?? {};

  if (!supabase_user_id || !variant_id) {
    console.error("[webhook] checkout.session.completed: missing metadata", session.metadata);
    return;
  }

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null;

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as Stripe.Customer | Stripe.DeletedCustomer | null)?.id ?? null;

  if (!stripeSubscriptionId || !stripeCustomerId) {
    console.error("[webhook] checkout.session.completed: missing subscription or customer", session.id);
    return;
  }

  // Stripe API 2026+ exposes the billing period on subscription items, not the
  // Subscription object — retrieve la suscripción para la fecha de periodo y
  // expandir latest_invoice (el primer invoice ya pagado en el checkout).
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["latest_invoice"],
    });
  } catch (err) {
    console.error("[stripe-handlers] subscriptions.retrieve failed", err);
    throw err;
  }
  const { current_period_start, current_period_end } = readPeriod(subscription);

  // Puntero de contenido inicial: la variante que compró, en la primera posición
  // que EXISTE en su currículo (no un 1 fijo). Entrar directo a cualquier nivel
  // es el caso normal —Aura evalúa fuera de la plataforma y manda a la cliente
  // al peldaño que le toca— y no necesita ningún desfase: entrar en Intermedio y
  // llegar a Intermedio son el mismo estado.
  const curricula = await readCurriculum(supabase, [variant_id]);
  const startOrdinal = firstOrdinal(curricula.get(variant_id) ?? []);
  if (startOrdinal === null) {
    console.error(
      "[webhook] la variante comprada no tiene currículo; puntero en 1",
      variant_id
    );
  }

  const { data: inserted, error } = await supabase
    .from("subscriptions")
    .insert({
      profile_id: supabase_user_id,
      program_variant_id: variant_id,
      content_variant_id: variant_id,
      content_ordinal: startOrdinal ?? 1,
      content_loops: 0,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      status: "active",
      months_elapsed: 1,
      enrollment_date: new Date().toISOString().split("T")[0],
      current_period_start,
      current_period_end,
    })
    .select("id")
    .single();

  if (error) console.error("[webhook] subscription insert error:", error);

  if (!error && inserted) {
    // G4: registrar el primer invoice AQUÍ (el evento que tiene la metadata y crea
    // la sub), no en invoice.paid. Stripe emite invoice.paid ~1s ANTES que
    // checkout.session.completed, así que el handler de invoice.paid no encuentra
    // la fila todavía. recordInvoice es idempotente (upsert), de modo que el
    // invoice.paid que llega en paralelo no duplica.
    const latest = subscription.latest_invoice;
    if (latest && typeof latest === "object" && latest.status === "paid") {
      await recordInvoice(latest as Stripe.Invoice, inserted.id);
    }
    const contact = await getProfileContact(supabase, supabase_user_id);
    if (contact) await sendWelcomeEmail({ to: contact.email, name: contact.name });
  }
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // In Stripe API 2026+, subscription is under parent.subscription_details.subscription
  const parent = invoice.parent as Stripe.Invoice.Parent | null;
  if (!parent || parent.type !== "subscription_details") return null;
  const sub = parent.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : (sub as Stripe.Subscription).id;
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // First invoice (subscription_create): RED DE SEGURIDAD. Stripe normalmente emite
  // invoice.paid ANTES que checkout.session.completed, así que la fila de la sub aún
  // no existe y el registro primario del primer invoice lo hace handleCheckoutCompleted
  // (que tiene la metadata). Aquí solo registramos si la sub YA existe (orden inverso),
  // de forma idempotente. No encontrarla en este punto es esperado, no un error.
  if (invoice.billing_reason === "subscription_create") {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      console.error("[webhook] invoice.paid (create): no subscription id", invoice.id);
      return;
    }
    const supabase = createServiceClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();
    if (sub) await recordInvoice(invoice, sub.id);
    // else: la sub aún no existe; checkout.session.completed registrará el primer
    // invoice. No se loguea como error para no generar falsas alarmas en cada alta.
    return;
  }

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    console.error("[webhook] invoice.paid: could not determine subscription id", invoice.id);
    return;
  }

  const supabase = createServiceClient();

  const { data: rawSub, error } = await supabase
    .from("subscriptions")
    .select(
      "id, months_elapsed, content_variant_id, content_ordinal, content_loops, program_variant_id, program_variants(programs(billing_model, duration_months))"
    )
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (error || !rawSub) {
    console.error("[webhook] invoice.paid: subscription not found", subscriptionId);
    return;
  }

  // keep: subscriptions JOIN program_variants JOIN programs — nested join shape not inferred by SDK.
  type SubWithVariant = {
    id: string;
    months_elapsed: number;
    content_variant_id: string | null;
    content_ordinal: number;
    content_loops: number;
    program_variant_id: string | null;
    program_variants: { programs: { billing_model: string; duration_months: number | null } | null } | null;
  };
  const sub = rawSub as SubWithVariant;

  // GUARDA DE IDEMPOTENCIA. Todo lo que avanza va después de esta línea: si la
  // factura ya estaba registrada, esta entrega es una redelivery de Stripe y no
  // hay nada que contar. Antes el incremento del mes no estaba protegido.
  const isNewInvoice = await recordInvoice(invoice, sub.id);
  if (!isNewInvoice) return;

  const program = sub.program_variants?.programs;
  const { newMonthsElapsed, shouldComplete } = computeMonthsUpdate(
    sub.months_elapsed,
    program?.billing_model ?? "rolling_monthly",
    program?.duration_months ?? null
  );

  const position = await nextContentPosition(supabase, sub, {
    billing_model: program?.billing_model ?? "rolling_monthly",
    duration_months: program?.duration_months ?? null,
  });

  // Una sola escritura: el mes y el puntero se mueven juntos o no se mueven.
  // `program_variant_id` NO se toca: es lo que compró y su vínculo con el precio
  // de Stripe; el peldaño en el que entrena es `content_variant_id`.
  const updatePayload = {
    months_elapsed: newMonthsElapsed,
    ...(shouldComplete ? { completed_at: new Date().toISOString() } : {}),
    ...(position
      ? {
          content_variant_id: position.variantId,
          content_ordinal: position.ordinal,
          content_loops: position.loops,
        }
      : {}),
  };

  // Guarda optimista: la escritura sólo pega si la fila sigue como se leyó.
  // Dos `invoice.paid` DISTINTAS de la misma suscripción procesadas en paralelo
  // leerían las dos el mismo `content_ordinal` y escribirían las dos: un mes de
  // entrenamiento saltado en silencio. Con la condición, la segunda no encuentra
  // fila, no escribe, y se relanza para que Stripe reintente con el valor ya
  // fresco.
  const { data: updated, error: updateError } = await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("id", sub.id)
    .eq("months_elapsed", sub.months_elapsed)
    .eq("content_ordinal", sub.content_ordinal)
    .select("id");

  if (updateError) {
    // Se relanza por la misma razón que en `recordInvoice`: la factura ya quedó
    // registrada, así que tragarse este fallo deja el mes cobrado sin avanzar y
    // ninguna redelivery lo arreglará.
    console.error("[webhook] subscription advance error:", updateError);
    throw new Error(`subscription advance failed: ${updateError.message}`);
  }

  if ((updated ?? []).length === 0) {
    console.error(
      "[webhook] avance perdido por escritura concurrente:",
      sub.id,
      invoice.id
    );
    throw new Error("subscription advance lost a concurrent write");
  }
}

/**
 * Registra la factura. Devuelve `true` sólo si la insertó de verdad; `false` si
 * ya estaba registrada (conflicto en `stripe_invoice_id`).
 *
 * Ese booleano es la guarda de idempotencia de todo el evento. Stripe reentrega
 * `invoice.paid` en reintentos y replays: el upsert evita duplicar la factura,
 * pero quien avanza el mes y el puntero de contenido tiene que saber si esta
 * entrega es la primera. Sin la guarda, una redelivery le SALTA a la cliente un
 * mes de entrenamiento sin dejar rastro y sin forma de distinguirlo después de
 * un avance normal.
 */
async function recordInvoice(
  invoice: Stripe.Invoice,
  subscriptionDbId?: string
): Promise<boolean> {
  if (!subscriptionDbId) return false;
  const supabase = createServiceClient();
  // Idempotente: checkout.session.completed e invoice.paid pueden intentar registrar
  // el mismo primer invoice; la constraint UNIQUE stripe_invoice_id + ignoreDuplicates
  // evita duplicados y errores en la carrera de eventos (G4).
  const { data, error } = await supabase
    .from("invoices")
    .upsert(
      {
        subscription_id: subscriptionDbId,
        stripe_invoice_id: invoice.id,
        amount_paid: invoice.amount_paid / 100,
        currency: invoice.currency,
        status: invoice.status ?? "paid",
        invoice_date: new Date(invoice.created * 1000).toISOString().split("T")[0],
      },
      { onConflict: "stripe_invoice_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    // Se relanza a propósito: la ruta responde 500 y Stripe reintenta. Antes un
    // fallo aquí era inocuo porque el mes se incrementaba igual; ahora TODO lo
    // que avanza cuelga de esta llamada, así que tragarse el error y responder
    // 200 convertiría un fallo transitorio de la base en un mes de
    // entrenamiento perdido para siempre. El reintento es seguro precisamente
    // por la guarda de idempotencia que este valor alimenta.
    console.error("[webhook] invoice upsert error:", error);
    throw new Error(`invoice upsert failed: ${error.message}`);
  }
  // Con `ignoreDuplicates`, un conflicto devuelve cero filas: eso ES la señal.
  return (data ?? []).length > 0;
}

/**
 * El currículo de una variante: sus posiciones tal como están AHORA.
 *
 * A diferencia de los lectores del portal, NO filtra por `program_series
 * .published`. Es deliberado: el puntero recorre el currículo que Aura ha
 * montado, y una serie sin publicar es un estado de edición transitorio, no un
 * hueco permanente. Saltársela dejaría a la cliente pasada de largo cuando Aura
 * publique; pararse en ella sólo deja el día vacío hasta que lo haga. La señal
 * de agotamiento de contenido del admin es la que avisa a tiempo.
 */
async function readCurriculum(
  supabase: ServiceClient,
  variantIds: string[]
): Promise<Map<string, CurriculumEntry[]>> {
  const byVariant = new Map<string, CurriculumEntry[]>();
  const { data, error } = await supabase
    .from("variant_series_map")
    .select("program_variant_id, series_id, ordinal")
    .in("program_variant_id", variantIds);

  if (error) {
    console.error("[webhook] curriculum read error:", error);
    return byVariant;
  }
  type MapRow = { program_variant_id: string; series_id: string; ordinal: number };
  for (const row of (data ?? []) as MapRow[]) {
    const entries = byVariant.get(row.program_variant_id) ?? [];
    entries.push({ ordinal: row.ordinal, series_id: row.series_id });
    byVariant.set(row.program_variant_id, entries);
  }
  return byVariant;
}

/**
 * La posición de contenido tras cobrar un mes.
 *
 * Lee el currículo EN ESTE MOMENTO —nunca un conteo guardado— para que publicar
 * una serie nueva no reordene a nadie: cada cliente avanza un paso desde donde
 * está. Devuelve `null` si la suscripción no tiene puntero ni variante que
 * sustituirlo, en cuyo caso el mes avanza igual y el contenido se queda como
 * estaba.
 */
async function nextContentPosition(
  supabase: ServiceClient,
  sub: {
    content_variant_id: string | null;
    content_ordinal: number;
    content_loops: number;
    program_variant_id: string | null;
    months_elapsed: number;
  },
  program: { billing_model: string; duration_months: number | null }
): Promise<LadderPosition | null> {
  const current = resolveContentPosition(sub);
  if (!current) return null;

  const { data: variantRow, error: variantError } = await supabase
    .from("program_variants")
    .select("id, ladder_next_variant_id")
    .eq("id", current.variantId)
    .single();

  if (variantError) {
    console.error("[webhook] ladder read error:", variantError);
    return null;
  }
  const nextVariantId =
    (variantRow as { ladder_next_variant_id: string | null } | null)
      ?.ladder_next_variant_id ?? null;

  const curricula = await readCurriculum(
    supabase,
    nextVariantId ? [current.variantId, nextVariantId] : [current.variantId]
  );

  return advanceLadderPosition({
    position: {
      variantId: current.variantId,
      ordinal: current.ordinal,
      loops: sub.content_loops,
    },
    currentRung: curricula.get(current.variantId) ?? [],
    nextRung: nextVariantId
      ? { variantId: nextVariantId, entries: curricula.get(nextVariantId) ?? [] }
      : null,
    billingModel:
      program.billing_model === "fixed_term_monthly"
        ? "fixed_term_monthly"
        : "rolling_monthly",
    durationMonths: program.duration_months,
    // El valor guardado, ANTES de contar esta factura: es la convención que
    // espera `advanceLadderPosition` y de la que depende que una CuarentaMás vea
    // su sexto mes en vez de congelarse en el quinto.
    monthsElapsed: sub.months_elapsed,
  });
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();
  // Re-source the billing period from subscription items (Stripe API 2026+) so renewals stay fresh.
  const { current_period_start, current_period_end } = readPeriod(subscription);
  const { error } = await supabase
    .from("subscriptions")
    .update({
      // keep: Stripe Subscription.Status includes statuses ("incomplete", "incomplete_expired")
      // not in our SubscriptionStatus union; mapping via cast as the DB stores them as-is.
      status: subscription.status as import("@/lib/supabase/types").SubscriptionStatus,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start,
      current_period_end,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) console.error("[webhook] subscription.updated error:", error);
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();
  const { data: subRow, error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", subscription.id)
    .select("id, profile_id")
    .maybeSingle();

  if (error) console.error("[webhook] subscription.deleted error:", error);

  // A9 — involuntary cancellation: dunning exhausted retries. Stripe tags why on
  // the object itself. Voluntary deletions (cancellation_requested) already have
  // a survey row from the portal flow, so we only auto-log payment failures here.
  const cancelReason = subscription.cancellation_details?.reason;
  if ((cancelReason === "payment_failed" || cancelReason === "payment_disputed") && subRow) {
    const row = subRow as { id: string; profile_id: string };
    // Idempotent: Stripe can redeliver customer.subscription.deleted. A subscription
    // is deleted once, so at most one involuntary row per subscription — skip if it
    // already exists rather than double-logging churn.
    const { data: existing } = await supabase
      .from("cancellation_surveys")
      .select("id")
      .eq("subscription_id", row.id)
      .eq("source", "involuntary")
      .maybeSingle();
    if (!existing) {
      const { error: surveyError } = await supabase.from("cancellation_surveys").insert({
        profile_id: row.profile_id,
        subscription_id: row.id,
        reason: "pago_fallido",
        source: "involuntary",
      });
      if (surveyError) console.error("[webhook] pago_fallido survey insert error:", surveyError);
    }
  }

  const contact = await getContactBySubscription(supabase, subscription.id);
  if (contact) await sendSubscriptionEndedEmail({ to: contact.email, name: contact.name });
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    console.error("[webhook] invoice.payment_failed: could not determine subscription id", invoice.id);
    return;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) console.error("[webhook] payment_failed update error:", error);

  const contact = await getContactBySubscription(supabase, subscriptionId);
  if (contact) await sendPaymentFailedEmail({ to: contact.email, name: contact.name });
}
