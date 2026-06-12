import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";
import {
  sendWelcomeEmail,
  sendPaymentFailedEmail,
  sendSubscriptionEndedEmail,
} from "@/lib/email/send";

// Stripe API 2026+ moved the billing period onto subscription items.
// The SubscriptionItem SDK type may not yet expose these fields, so read them defensively.
type ItemPeriod = { current_period_start?: number; current_period_end?: number };

function readPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] as unknown as ItemPeriod | undefined;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function getProfileContact(supabase: AnyClient, profileId: string): Promise<{ email: string; name: string } | null> {
  const { data } = await supabase.from("profiles").select("email, full_name").eq("id", profileId).single();
  if (!data?.email) return null;
  return { email: data.email, name: data.full_name ?? "" };
}

async function getContactBySubscription(supabase: AnyClient, stripeSubscriptionId: string): Promise<{ email: string; name: string } | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("profiles(email, full_name)")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .single();
  const p = data?.profiles as { email: string; full_name: string | null } | null;
  if (!p?.email) return null;
  return { email: p.email, name: p.full_name ?? "" };
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase: AnyClient = createServiceClient();
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
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["latest_invoice"],
  });
  const { current_period_start, current_period_end } = readPeriod(subscription);

  const { data: inserted, error } = await supabase
    .from("subscriptions")
    .insert({
      profile_id: supabase_user_id,
      program_variant_id: variant_id,
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
  // First invoice (subscription_create): la suscripción ya existe (creada por
  // checkout.session.completed). Buscamos su id para registrar el primer pago.
  if (invoice.billing_reason === "subscription_create") {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      console.error("[webhook] invoice.paid (create): no subscription id", invoice.id);
      return;
    }
    const supabase: AnyClient = createServiceClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();
    if (sub) await recordInvoice(invoice, sub.id);
    else console.error("[webhook] invoice.paid (create): subscription not found", subscriptionId);
    return;
  }

  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    console.error("[webhook] invoice.paid: could not determine subscription id", invoice.id);
    return;
  }

  const supabase: AnyClient = createServiceClient();

  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("id, months_elapsed, program_variants(programs(billing_model, duration_months))")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (error || !sub) {
    console.error("[webhook] invoice.paid: subscription not found", subscriptionId);
    return;
  }

  await recordInvoice(invoice, sub.id);

  const program = sub.program_variants?.programs;
  const { newMonthsElapsed, shouldComplete } = computeMonthsUpdate(
    sub.months_elapsed,
    program?.billing_model ?? "rolling_monthly",
    program?.duration_months ?? null
  );

  const updatePayload: Record<string, unknown> = { months_elapsed: newMonthsElapsed };
  if (shouldComplete) updatePayload.completed_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("id", sub.id);

  if (updateError) console.error("[webhook] months_elapsed update error:", updateError);
}

async function recordInvoice(invoice: Stripe.Invoice, subscriptionDbId?: string) {
  if (!subscriptionDbId) return;
  const supabase: AnyClient = createServiceClient();
  // Idempotente: checkout.session.completed e invoice.paid pueden intentar registrar
  // el mismo primer invoice; la constraint UNIQUE stripe_invoice_id + ignoreDuplicates
  // evita duplicados y errores en la carrera de eventos (G4).
  await supabase.from("invoices").upsert(
    {
      subscription_id: subscriptionDbId,
      stripe_invoice_id: invoice.id,
      amount_paid: invoice.amount_paid / 100,
      currency: invoice.currency,
      status: invoice.status ?? "paid",
      invoice_date: new Date(invoice.created * 1000).toISOString().split("T")[0],
    },
    { onConflict: "stripe_invoice_id", ignoreDuplicates: true }
  );
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase: AnyClient = createServiceClient();
  // Re-source the billing period from subscription items (Stripe API 2026+) so renewals stay fresh.
  const { current_period_start, current_period_end } = readPeriod(subscription);
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start,
      current_period_end,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) console.error("[webhook] subscription.updated error:", error);
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase: AnyClient = createServiceClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", subscription.id);

  if (error) console.error("[webhook] subscription.deleted error:", error);

  const contact = await getContactBySubscription(supabase, subscription.id);
  if (contact) await sendSubscriptionEndedEmail({ to: contact.email, name: contact.name });
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    console.error("[webhook] invoice.payment_failed: could not determine subscription id", invoice.id);
    return;
  }

  const supabase: AnyClient = createServiceClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) console.error("[webhook] payment_failed update error:", error);

  const contact = await getContactBySubscription(supabase, subscriptionId);
  if (contact) await sendPaymentFailedEmail({ to: contact.email, name: contact.name });
}
