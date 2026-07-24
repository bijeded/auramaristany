"use client";
import { CalendarClock } from "lucide-react";

export function AgendarBlockEditor() {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border p-3 font-body text-sm"
      style={{ borderColor: "var(--gris-linea)", color: "var(--gris-texto)" }}
    >
      <CalendarClock size={16} color="var(--lavanda-dark)" />
      El cliente verá un botón para agendar su llamada 1:1. Colócalo en los días
      en que quieras abrir la ventana de reserva. No hay nada que configurar.
    </div>
  );
}
