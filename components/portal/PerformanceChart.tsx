"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { PerfPoint } from "@/lib/content/history-helpers";

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  reps_done: { label: "Reps", unit: "" },
  weight_kg: { label: "Peso", unit: " kg" },
};

function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function PerformanceChart({
  points,
  metric,
}: {
  points: PerfPoint[];
  metric: string;
}) {
  const unit = METRIC_LABELS[metric]?.unit ?? "";
  const data = points
    .filter((p) => p.values[metric] != null)
    .map((p) => ({ date: shortDate(p.date), value: p.values[metric] as number }));

  if (data.length < 2) {
    return (
      <div className="font-body" style={{ textAlign: "center", padding: "40px 10px", fontSize: 13, color: "var(--gris-texto)" }}>
        Registra al menos 2 entrenamientos para ver tu progreso
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#f0eae9" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--gris-suave)" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--gris-suave)" }} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          formatter={(v: unknown) => [`${v}${unit}`, METRIC_LABELS[metric]?.label ?? metric]}
          contentStyle={{ borderRadius: 8, fontSize: 12, fontFamily: "var(--font-body)" }}
        />
        <Line type="monotone" dataKey="value" stroke="#9982f4" strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: "#9982f4", strokeWidth: 2.5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
