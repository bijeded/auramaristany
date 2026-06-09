"use client";
import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { cardioZone2 } from "@/lib/content/cardio";

export function CardioZone2Block() {
  const [edad, setEdad] = useState("");
  const edadNum = Number(edad);
  const valid = edad !== "" && Number.isFinite(edadNum) && edadNum >= 18 && edadNum <= 110;
  const { suelo, cielo } = valid ? cardioZone2(edadNum) : { suelo: null, cielo: null };

  return (
    <div className="mb-6 rounded-xl p-4" style={{ background: "var(--lavanda-tint)" }}>
      <div className="flex items-center gap-2 mb-3 font-head" style={{ color: "var(--lavanda-dark)" }}>
        <HeartPulse size={18} /> Calculadora Cardio Zona 2
      </div>
      <label className="block font-body text-sm mb-1">Tu edad (años)</label>
      <input type="number" inputMode="numeric" min={18} max={110} value={edad}
        onChange={(e) => setEdad(e.target.value)}
        className="rounded-lg border px-3 py-2 font-body text-sm w-32"
        style={{ borderColor: "var(--gris-linea)" }} />
      {edad !== "" && !valid && (
        <p className="mt-2 font-body" style={{ color: "var(--error)", fontSize: 13 }}>
          Ingresa una edad adecuada.
        </p>
      )}
      {suelo !== null && cielo !== null && (
        <div className="mt-4 text-center">
          <div
            className="font-head"
            style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1, color: "var(--lavanda-dark)" }}
          >
            {suelo} – {cielo}
          </div>
          <div
            className="font-body mt-1"
            style={{ fontSize: 12, color: "var(--gris-texto)" }}
          >
            pulsaciones por minuto
          </div>
          {/* Illustrative gauge: track spans ~50%–100% of max HR; Zona 2 (60–70%) highlighted */}
          <div
            className="relative mx-auto mt-4 rounded-full overflow-hidden"
            style={{ height: 10, maxWidth: 240, background: "var(--blanco)" }}
          >
            <div
              className="absolute top-0 h-full rounded-full"
              style={{
                // Track represents 50%–100% of FC máx (span of 50 percentage points).
                // Zona 2 = 60%–70% → starts at (60-50)/50 = 20%, width (70-60)/50 = 20%.
                left: "20%",
                width: "20%",
                background: "var(--lavanda)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
