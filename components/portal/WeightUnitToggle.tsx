"use client";

import type { WeightUnit } from "@/hooks/useProgressForm";

// Selector kg/lb compartido por /portal/today y Desempeño (D29). Una sola copia:
// `className` es sólo para colocarlo en el layout, nunca para sus dimensiones.
export function WeightUnitToggle({
  unit,
  onChange,
  className = "",
}: {
  unit: WeightUnit;
  onChange: (u: WeightUnit) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Unidad de peso"
      className={`inline-flex rounded-full ${className}`.trim()}
      style={{ border: "1.5px solid var(--gris-linea)", overflow: "hidden" }}
    >
      {(["kg", "lb"] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          aria-pressed={unit === u}
          className="font-body"
          style={{
            minWidth: 44,
            minHeight: 32,
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 600,
            background: unit === u ? "var(--lavanda)" : "#fff",
            color: unit === u ? "#fff" : "var(--gris-texto)",
            transition: "all 0.15s ease",
          }}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
