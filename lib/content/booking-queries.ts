import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { BookingStatus } from "@/lib/supabase/types";
import {
  escapeLikePattern,
  hasFutureCall,
  nextScheduledDate,
  type BookingLike,
} from "./booking-helpers";
import { serverToday } from "./server-today";

export interface BookingState {
  hasFutureCall: boolean;
  nextCallDate: string | null; // ISO — sólo cuando hasFutureCall
}

/**
 * Estado de reserva del cliente para el bloque "agendar" y el gate de
 * /portal/booking (una sola fuente). Deriva `now` respetando DEV_DATE.
 */
export async function getBookingState(userId: string): Promise<BookingState> {
  const now = serverToday();
  const bookings = await getUserBookings(userId);
  return {
    hasFutureCall: hasFutureCall(bookings, now),
    nextCallDate: nextScheduledDate(bookings, now),
  };
}

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
 * Resuelve el profile_id a partir del email del invitee (service-role, se
 * salta RLS). Devuelve null si ningún perfil coincide — el webhook entonces
 * confirma el evento sin escribir (brecha de mapeo aceptada).
 *
 * ⚠ El email viene de terceros (Calendly). Se escapan los metacaracteres LIKE
 * (`%`, `_`, `\`) antes de `ilike`: `_` es un carácter válido de email y a la
 * vez comodín LIKE — sin escapar, `john_doe@x` haría match con `johnXdoe@x`
 * (atribución cruzada). Con escape, el match es literal pero case-insensitive.
 */
export async function getProfileIdByEmail(email: string): Promise<string | null> {
  const supabase = createServiceClient();
  const escaped = escapeLikePattern(email);
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", escaped)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Upsert idempotente de una reserva (invitee.created) desde el webhook.
 * Escribe con service-role — el cliente nunca escribe reservas. onConflict en
 * calendly_invitee_uri (Calendly reentrega eventos).
 *
 * ⚠ Sólo debe invocarse tras verificar la firma del webhook.
 * La cancelación NO pasa por aquí (ver markBookingCanceled): así una fila
 * cancelada es terminal. Residual aceptado: una reentrega tardía y fuera de
 * orden de invitee.created tras un cancel podría reactivar la fila; Calendly
 * sólo reentrega el mismo evento como reintento (antes de cualquier cancel),
 * por lo que no ocurre en la práctica (ver design.md, riesgo de webhook-lag).
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
 * Marca una reserva como cancelada (invitee.canceled). Update-only por
 * invitee_uri (service-role): idempotente, sin resurrección y sin crear filas
 * huérfanas si el cancel llega sin un created previo. No necesita el email.
 *
 * ⚠ Sólo debe invocarse tras verificar la firma del webhook.
 */
export async function markBookingCanceled(calendlyInviteeUri: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("bookings")
    .update({ status: "canceled" satisfies BookingStatus })
    .eq("calendly_invitee_uri", calendlyInviteeUri);
}
