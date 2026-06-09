"use client";
import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { cardioZone2 } from "@/lib/content/cardio";

export function CardioZone2Block() {
  const [edad, setEdad] = useState("");
  const { suelo, cielo } = cardioZone2(Number(edad));

  return (
    <div className="mb-6 rounded-xl p-4" style={{ background: "var(--lavanda-tint)" }}>
      <div className="flex items-center gap-2 mb-3 font-head" style={{ color: "var(--lavanda-dark)" }}>
        <HeartPulse size={18} /> Calculadora Cardio Zona 2
      </div>
      <label className="block font-body text-sm mb-1">Tu edad (años)</label>
      <input type="number" inputMode="numeric" value={edad}
        onChange={(e) => setEdad(e.target.value)}
        className="rounded-lg border px-3 py-2 font-body text-sm w-32"
        style={{ borderColor: "var(--gris-linea)" }} />
      {suelo !== null && cielo !== null && (
        <p className="mt-3 font-body text-sm" style={{ color: "var(--negro)" }}>
          Tu Cardio zona 2 se encuentra en el rango: <strong>{suelo} – {cielo}</strong>
        </p>
      )}
    </div>
  );
}
