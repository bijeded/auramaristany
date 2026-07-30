import Link from "next/link";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { longDateLabel } from "@/lib/admin/date-helpers";

export interface AgendarBookingState {
  hasFutureCall: boolean;
  nextCallDate: string | null; // ISO — sólo cuando hasFutureCall
}

/**
 * Bloque "Agendar llamada". El estado lo decide la reserva del cliente:
 *  - con `booking` y sin llamada futura → CTA activo a /portal/booking
 *  - con `booking` y una llamada futura → deshabilitado ("Tu llamada es el …")
 *  - sin `booking` (historial/pilares, solo lectura) → nota informativa inerte
 * Así, reservar en el primer día de la ventana deshabilita el CTA los días
 * siguientes (misma regla del gate: una llamada futura a la vez).
 */
export function AgendarBlock({ booking }: { booking?: AgendarBookingState }) {
  const cardStyle = {
    background: "var(--lavanda-tint)",
  } as const;

  // Ya tiene una llamada agendada → deshabilitado.
  if (booking?.hasFutureCall) {
    return (
      <div className="mb-6 rounded-xl p-4" style={cardStyle}>
        <div className="flex items-center gap-2 font-head" style={{ color: "var(--lavanda-dark)" }}>
          <CheckCircle2 size={18} />
          {booking.nextCallDate
            ? `Tu llamada es el ${longDateLabel(booking.nextCallDate)}`
            : "Ya tienes una llamada agendada"}
        </div>
        <p className="font-body mt-1" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
          Te esperamos. Si necesitas moverla, hazlo desde el correo de confirmación.
        </p>
      </div>
    );
  }

  // Solo lectura (historial / pilares): nota inerte, sin CTA.
  if (!booking) {
    return (
      <div className="mb-6 rounded-xl p-4" style={cardStyle}>
        <div className="flex items-center gap-2 font-head" style={{ color: "var(--lavanda-dark)" }}>
          <CalendarClock size={18} /> Llamada 1:1
        </div>
      </div>
    );
  }

  // CTA activo.
  return (
    <div className="mb-6 rounded-xl p-4" style={cardStyle}>
      <div className="flex items-center gap-2 font-head mb-1" style={{ color: "var(--lavanda-dark)" }}>
        <CalendarClock size={18} /> Agenda tu llamada 1:1
      </div>
      <p className="font-body mb-3" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
        Reserva un momento para platicar sobre tu avance.
      </p>
      <Link
        href="/portal/booking"
        className="inline-flex items-center justify-center rounded-lg font-head font-semibold"
        style={{
          minHeight: 48,
          padding: "0 20px",
          background: "var(--lavanda)",
          color: "var(--blanco)",
        }}
      >
        Agendar mi llamada
      </Link>
    </div>
  );
}
