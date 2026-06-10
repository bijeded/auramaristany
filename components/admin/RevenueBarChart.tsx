"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { MonthRevenue } from "@/lib/admin/finance-helpers";

export function RevenueBarChart({ data }: { data: MonthRevenue[] }) {
  if (data.every((d) => d.total === 0)) {
    return (
      <div className="font-body" style={{ textAlign: "center", padding: "40px 10px", fontSize: 13, color: "var(--gris-texto)" }}>
        Aún no hay ingresos registrados
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="#f0eae9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--gris-suave)" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--gris-suave)" }} tickLine={false} axisLine={false} width={48}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v: unknown) => [`$${Number(v).toLocaleString("es-MX")}`, "Ingresos"]}
          contentStyle={{ borderRadius: 8, fontSize: 12, fontFamily: "var(--font-body)" }}
        />
        <Bar dataKey="total" fill="#9982f4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
