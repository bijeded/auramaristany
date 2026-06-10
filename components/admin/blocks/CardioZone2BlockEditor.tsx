"use client";
import { HeartPulse } from "lucide-react";

export function CardioZone2BlockEditor() {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3 font-body text-sm"
      style={{ borderColor: "var(--gris-linea)", color: "var(--gris-texto)" }}>
      <HeartPulse size={16} color="var(--lavanda-dark)" />
      El cliente verá la calculadora de Cardio Zona 2 (ingresa su edad → rango). No hay nada que configurar.
    </div>
  );
}
