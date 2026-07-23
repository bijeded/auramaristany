"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Dumbbell } from "lucide-react";
import { PerformanceChart } from "./PerformanceChart";
import type { PerfExercise } from "@/lib/content/history-helpers";
import type { HistoryListItem } from "@/lib/content/history";
import type { WeightUnit } from "@/hooks/useProgressForm";

const METRIC_LABELS: Record<string, string> = {
  reps_done: "Reps",
  weight_kg: "Peso",
};

function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function PerformanceTab({
  performance,
  history,
}: {
  performance: PerfExercise[];
  history: HistoryListItem[];
}) {
  const [exIdx, setExIdx] = useState(0);
  const selected = performance[exIdx];
  const [metric, setMetric] = useState<string>(selected?.metrics[0] ?? "weight_kg");
  // A1 — unidad de visualización del Peso (solo presentación; los datos son kg)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");

  // Asegura que la métrica seleccionada exista para el ejercicio actual.
  const activeMetric = selected?.metrics.includes(metric)
    ? metric
    : selected?.metrics[0] ?? "weight_kg";

  return (
    <>
      {performance.length === 0 ? (
        <div className="font-body" style={{ textAlign: "center", padding: "32px 10px", fontSize: 14, color: "var(--gris-texto)" }}>
          Aún no hay registros este mes. Cuando guardes tu progreso, aquí verás tus gráficas.
        </div>
      ) : (
        <>
          <h3 className="font-head" style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
            Tu desempeño
          </h3>
          <p className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)", marginBottom: 12 }}>
            Tu progreso este mes, ejercicio por ejercicio.
          </p>

          {/* Selector de ejercicio (pills) */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ marginBottom: 12 }}>
            {performance.map((p, i) => (
              <button
                key={p.exerciseId}
                onClick={() => setExIdx(i)}
                className="font-body whitespace-nowrap rounded-full px-3 py-1.5"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  background: i === exIdx ? "var(--lavanda)" : "var(--gris-claro)",
                  color: i === exIdx ? "#fff" : "var(--gris-texto)",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Toggle de métrica + unidad kg/lb */}
          {selected && (selected.metrics.length > 1 || activeMetric === "weight_kg") && (
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              {selected.metrics.length > 1 && selected.metrics.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className="font-body rounded-full px-3 py-1"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    background: m === activeMetric ? "var(--negro)" : "var(--gris-claro)",
                    color: m === activeMetric ? "#fff" : "var(--gris-texto)",
                  }}
                >
                  {METRIC_LABELS[m] ?? m}
                </button>
              ))}

              {/* Toggle kg/lb — solo para la métrica Peso */}
              {activeMetric === "weight_kg" && (
                <div className="flex gap-0 ml-auto rounded-full" style={{ border: "1.5px solid var(--gris-linea)", overflow: "hidden" }}>
                  {(["kg", "lb"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setWeightUnit(u)}
                      aria-pressed={weightUnit === u}
                      className="font-body px-3 py-1"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        minWidth: 44,
                        background: weightUnit === u ? "var(--lavanda)" : "#fff",
                        color: weightUnit === u ? "#fff" : "var(--gris-texto)",
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl p-3" style={{ background: "#fff", border: "1.5px solid var(--gris-linea)", marginBottom: 24 }}>
            {selected && <PerformanceChart points={selected.points} metric={activeMetric} weightUnit={weightUnit} />}
          </div>
        </>
      )}

      <h3 className="font-head" style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Historial de ejercicios
      </h3>
      {history.length === 0 ? (
        <p className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
          Todavía no tienes entrenamientos registrados.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((h) => (
            <Link
              key={h.logId}
              href={`/portal/history/${h.logId}`}
              className="flex items-center justify-between rounded-xl"
              style={{ padding: "13px 16px", background: "#fff", border: "1.5px solid var(--gris-linea)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 36, height: 36, background: "var(--lavanda-tint)", flexShrink: 0 }}
                >
                  <Dumbbell size={17} color="var(--lavanda-dark)" />
                </div>
                <div>
                  <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>
                    {h.dayTitle}
                  </div>
                  <div className="font-body" style={{ fontSize: 11.5, color: "var(--gris-suave)" }}>
                    {shortDate(h.logDate)}
                    {h.workoutFocus ? ` · ${h.workoutFocus}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="font-body rounded-full px-2.5 py-1"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: h.totalCount > 0 && h.doneCount === h.totalCount ? "rgba(76,175,125,.14)" : "var(--gris-claro)",
                    color: h.totalCount > 0 && h.doneCount === h.totalCount ? "#3a8c60" : "var(--gris-texto)",
                  }}
                >
                  {h.doneCount}/{h.totalCount}
                </span>
                <ChevronRight size={16} color="var(--gris-suave)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
