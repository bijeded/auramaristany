import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { BookingLike } from "./booking-helpers";

/**
 * Reservas del usuario autenticado (vía RLS — owner-select). Se usan para
 * derivar "¿tiene una llamada futura?" en el gate y en el bloque agendar.
 *
 * `userId` DEBE venir de getUser() en el server (mismo patrón que
 * getTodayContent/getWeekCalendar). Corre sobre el cliente RLS-aware, cuya
 * policy re-acota a auth.uid(): un id ajeno no devuelve filas. RLS es la
 * defensa real; el parámetro es sólo conveniencia. Nunca usar service-role aquí.
 */
export async function getUserBookings(userId: string): Promise<BookingLike[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("scheduled_at, status")
    .eq("profile_id", userId);
  if (error) {
    console.error("[booking-queries] getUserBookings:", error.message);
    return [];
  }
  return (data ?? []) as BookingLike[];
}

/**
 * Upsert idempotente de una reserva desde el webhook de Calendly
 * (invitee.created). Escribe con service-role — el cliente nunca escribe
 * reservas. onConflict en calendly_invitee_uri (Calendly reentrega eventos).
 *
 * ⚠ Sólo debe invocarse tras verificar la firma del webhook (PR del webhook).
 * TODO(webhook PR): una reentrega de invitee.created tras un invitee.canceled
 * resucitaría la fila a 'active'. Se resolverá con orden por timestamp del
 * evento cuando se maneje el payload completo del webhook.
 */
export async function upsertBookingFromWebhook(params: {
  profileId: string;
  calendlyInviteeUri: string;
  calendlyEventUri: string | null;
  scheduledAt: string;
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("bookings").upsert(
    {
      profile_id: params.profileId,
      calendly_invitee_uri: params.calendlyInviteeUri,
      calendly_event_uri: params.calendlyEventUri,
      scheduled_at: params.scheduledAt,
      status: "active",
    },
    { onConflict: "calendly_invitee_uri" }
  );
}

/**
 * Marca una reserva como cancelada desde el webhook (invitee.canceled).
 * Service-role. Idempotente: si la fila no existe, no hace nada.
 */
export async function markBookingCanceled(calendlyInviteeUri: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("bookings")
    .update({ status: "canceled" })
    .eq("calendly_invitee_uri", calendlyInviteeUri);
}
