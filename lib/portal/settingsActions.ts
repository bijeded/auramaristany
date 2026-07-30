"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePhone } from "@/lib/auth/phone";
import { stripe } from "@/lib/stripe";
import { sanitizePlainText } from "@/lib/admin/sanitize-html";
import { reasonRequiresDetail, isCompletionScheduled } from "@/lib/portal/cancellation";
import type { SubscriptionStatus } from "@/lib/supabase/types";
import { createClient as createStatelessClient } from "@supabase/supabase-js";

export type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "No se pudo guardar. Intenta más tarde.";

// A9 — eligible statuses a client may cancel from.
const CANCELABLE_STATUSES: SubscriptionStatus[] = ["active", "trialing", "past_due"];

const cancelInputSchema = z.object({
  reason: z.enum([
    "precio_muy_caro",
    "no_tengo_tiempo",
    "no_logre_objetivo",
    "no_veo_resultados",
    "encontre_otra_opcion",
    "otro",
    "prefiero_no_decir",
  ]).optional(),
  detail: z.string().max(200).optional(),
});

type OwnedSub = {
  id: string;
  stripe_subscription_id: string;
  status: string;
  completed_at: string | null;
  cancel_at_period_end: boolean | null;
};

/** Resolve the caller's cancelable subscription from getUser() — never trust a
 *  client-sent id (INP-4/EDGE-5). Returns null if none is eligible. */
async function getOwnedCancelableSub(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<OwnedSub | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("id, stripe_subscription_id, status, completed_at, cancel_at_period_end")
    .eq("profile_id", userId)
    .in("status", CANCELABLE_STATUSES)
    .order("enrollment_date", { ascending: false });

  // El filtro se hace aquí y NO en SQL con `completed_at is null`: esa columna
  // a solas no prueba que haya una cancelación programada (L2b la escribía sin
  // cancelar nada), y descartar por ella dejaba a una cliente con una fila
  // vieja cobrando y sin forma de pararlo desde el portal. Se descarta sólo lo
  // que de verdad está terminando, y así una CuarentaMás en su último mes no
  // le secuestra la acción a una Extra que sí paga.
  const rows = (data as OwnedSub[] | null) ?? [];
  // Se PREFIERE la que no está terminando, pero si no hay otra se devuelve la
  // que sí: así las guardas de abajo llegan a ejecutarse y la cliente lee por
  // qué no puede, en vez del genérico "no tienes ninguna suscripción".
  const usable = rows.find(
    (r) => !isCompletionScheduled({ completedAt: r.completed_at, cancelAtPeriodEnd: r.cancel_at_period_end })
  );
  return usable ?? rows[0] ?? null;
}

export async function cancelSubscription(input: { reason?: string; detail?: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: GENERIC_ERROR };

  const parsed = cancelInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const { reason, detail: rawDetail } = parsed.data;

  // Only the two free-text reasons keep a detail; sanitize + re-check length.
  let detail: string | null = null;
  if (reason && reasonRequiresDetail(reason) && rawDetail) {
    const clean = sanitizePlainText(rawDetail);
    if (clean.length > 200) return { ok: false, error: GENERIC_ERROR };
    detail = clean.length > 0 ? clean : null;
  }

  const sub = await getOwnedCancelableSub(supabase, user.id);
  if (!sub) return { ok: false, error: "No tienes una suscripción activa que cancelar." };

  // Simétrico al de `reactivateSubscription`: una suscripción que ya está
  // terminando no se cancela. Su cancelación en Stripe ya está programada, así
  // que lo único que añadiría es una fila de encuesta "voluntary" para una
  // cliente que TERMINÓ en vez de irse — dato de baja falseado.
  if (isCompletionScheduled({ completedAt: sub.completed_at, cancelAtPeriodEnd: sub.cancel_at_period_end })) {
    return { ok: false, error: "Tu programa ya está por terminar; no hay nada que cancelar." };
  }

  // Cancel in Stripe first — it is the primary action and the source of truth.
  try {
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
  } catch (err) {
    console.error("[cancelSubscription] stripe", err);
    return { ok: false, error: GENERIC_ERROR };
  }

  // Optimistic local mirror; handleSubscriptionUpdated remains the source of truth.
  await supabase.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", sub.id);

  // Record the survey (best-effort telemetry). A failure here must not fail the
  // cancellation, which already succeeded — so no orphan survey row can exist for
  // a cancellation that didn't happen.
  //
  // OJO, ése es el precio de tragarse el error: si el valor no está en el CHECK
  // de `cancellation_surveys.reason`, el insert se rechaza y la fila se pierde
  // EN SILENCIO —ni el cliente, ni Aura, ni CI ven nada—. Por eso la migración
  // que agrega un motivo va SIEMPRE antes que el código que lo nombra (D19,
  // migración 019). No "arregles" esto propagando el error: lo correcto es no
  // desplegar un valor que la base no acepta.
  //
  // D19 — sin razón, `prefiero_no_decir` y no "otro": confirmar sin elegir nada
  // ES no querer decirlo. Guardarlo como "Otro" mezclaba a quien declinaba con
  // quien daba un motivo fuera de la lista, y son respuestas opuestas.
  const { error: insertError } = await supabase.from("cancellation_surveys").insert({
    profile_id: user.id,
    subscription_id: sub.id,
    reason: reason ?? "prefiero_no_decir",
    detail,
    source: "voluntary",
  });
  if (insertError) console.error("[cancelSubscription] survey insert", insertError);

  revalidatePath("/portal/settings");
  return { ok: true };
}

export async function reactivateSubscription(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: GENERIC_ERROR };

  const sub = await getOwnedCancelableSub(supabase, user.id);
  if (!sub) return { ok: false, error: GENERIC_ERROR };

  // L2c — una suscripción con la completion ya programada NO se reactiva. Está
  // en su último mes de plazo fijo: quitarle `cancel_at_period_end` en Stripe le
  // cobraría un mes 7 contra un programa que no lo tiene. La pantalla ya no
  // ofrece el botón, pero esconder un botón no es una comprobación: la acción es
  // invocable por sí sola.
  if (isCompletionScheduled({ completedAt: sub.completed_at, cancelAtPeriodEnd: sub.cancel_at_period_end })) {
    return { ok: false, error: "Tu programa ya terminó y no se puede reactivar." };
  }

  try {
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: false });
  } catch (err) {
    console.error("[reactivateSubscription] stripe", err);
    return { ok: false, error: GENERIC_ERROR };
  }

  await supabase.from("subscriptions").update({ cancel_at_period_end: false }).eq("id", sub.id);

  // Delete the latest voluntary survey row for this subscription. RLS scopes the
  // delete to the owner's own voluntary rows, so a pago_fallido row is never touched.
  const { data: latest } = await supabase
    .from("cancellation_surveys")
    .select("id")
    .eq("subscription_id", sub.id)
    .eq("source", "voluntary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest) await supabase.from("cancellation_surveys").delete().eq("id", (latest as { id: string }).id);

  revalidatePath("/portal/settings");
  return { ok: true };
}

export async function updateAccount(input: { fullName: string; phone: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: GENERIC_ERROR };

  const fullName = input.fullName.trim();
  if (fullName.length === 0) return { ok: false, error: "Ingresa tu nombre." };
  if (fullName.length > 120) return { ok: false, error: "El nombre es demasiado largo." };

  const phoneCheck = validatePhone(input.phone);
  if (!phoneCheck.ok) return { ok: false, error: phoneCheck.error! };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phoneCheck.normalized })
    .eq("id", user.id);

  if (error) {
    console.error("[updateAccount]", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/portal/settings");
  revalidatePath("/portal", "layout");
  return { ok: true };
}

export async function updatePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: GENERIC_ERROR };

  if (input.newPassword.length < 8) return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (input.newPassword !== input.confirmPassword) return { ok: false, error: "Las contraseñas no coinciden." };
  if (input.newPassword === input.currentPassword) return { ok: false, error: "La nueva contraseña debe ser distinta a la actual." };

  // Verifica la contraseña actual con un cliente SIN cookies (no toca la sesión activa).
  const stateless = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: signInError } = await stateless.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (signInError) return { ok: false, error: "La contraseña actual es incorrecta." };

  const { error: updateError } = await supabase.auth.updateUser({ password: input.newPassword });
  if (updateError) {
    console.error("[updatePassword]", updateError);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
}
