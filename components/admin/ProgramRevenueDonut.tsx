"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ProgramRevenue } from "@/lib/admin/finance-helpers";

const COLORS = ["#9982f4", "#e0aaba", "#7fc8a9", "#f0c674", "#8fb8de", "#c9a0dc"];

export function ProgramRevenueDonut({ data }: { data: ProgramRevenue[] }) {
  if (data.length === 0) {
    return (
      <div className="font-body" style={{ textAlign: "center", padding: "40px 10px", fontSize: 13, color: "var(--gris-texto)" }}>
        Aún no hay ingresos por programa
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="program" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: unknown) => `$${Number(v).toLocaleString("es-MX")}`}
          contentStyle={{ borderRadius: 8, fontSize: 12, fontFamily: "var(--font-body)" }} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-body)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
