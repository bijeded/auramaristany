// Pure booking helpers (testeable, sin acceso a DB). La regla de negocio es
// "una llamada futura no cancelada a la vez": la usan tanto el gate de
// /portal/booking como el estado del bloque "agendar".
import type { BookingStatus } from "@/lib/supabase/types";

export interface BookingLike {
  scheduled_at: string;
  status: BookingStatus;
}

function futureActive(bookings: BookingLike[], now: Date): BookingLike[] {
  const nowMs = now.getTime();
  return bookings.filter(
    (b) => b.status === "active" && new Date(b.scheduled_at).getTime() > nowMs
  );
}

/** ¿El cliente tiene una llamada activa agendada en el futuro? */
export function hasFutureCall(bookings: BookingLike[], now: Date): boolean {
  return futureActive(bookings, now).length > 0;
}

/** Fecha (ISO) de la próxima llamada activa futura, o null si no hay. */
export function nextScheduledDate(bookings: BookingLike[], now: Date): string | null {
  const upcoming = futureActive(bookings, now);
  if (upcoming.length === 0) return null;
  return upcoming.reduce((earliest, b) =>
    new Date(b.scheduled_at).getTime() < new Date(earliest.scheduled_at).getTime() ? b : earliest
  ).scheduled_at;
}

/** ¿El día actual expone un bloque "agendar" (ventana de reserva abierta)? */
export function dayHasAgendarBlock(blocks: { block_type: string }[]): boolean {
  return blocks.some((b) => b.block_type === "agendar");
}

/**
 * Escapa los metacaracteres LIKE (`\`, `%`, `_`) de un valor que viene de
 * terceros, para usarlo como patrón literal en un filtro `ilike`. `_` es un
 * carácter válido de email a la vez que comodín LIKE: sin escapar habilita
 * atribución cruzada (ver getProfileIdByEmail). El backslash va primero.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}
