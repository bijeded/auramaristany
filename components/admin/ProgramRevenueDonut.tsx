"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import type { ProgramRevenue } from "@/lib/admin/finance-helpers";

const fmtMxn = (v: number) => `$${v.toLocaleString("es-MX")}`;

// A10 — horizontal bars (was a donut); same data from groupRevenueByProgram
export function ProgramRevenueDonut({ data }: { data: ProgramRevenue[] }) {
  if (data.length === 0) {
    return (
      <div className="font-body" style={{ textAlign: "center", padding: "40px 10px", fontSize: 13, color: "var(--gris-texto)" }}>
        Aún no hay ingresos por programa
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 48 + 24)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="program"
          width={120}
          tick={{ fontSize: 11, fill: "var(--gris-texto)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v: unknown) => [fmtMxn(Number(v)), "Ingresos"]}
          contentStyle={{ borderRadius: 8, fontSize: 12, fontFamily: "var(--font-body)" }}
        />
        <Bar dataKey="total" fill="#9982f4" radius={[0, 4, 4, 0]} barSize={22}>
          <LabelList
            dataKey="total"
            position="right"
            formatter={(v) => fmtMxn(Number(v))}
            style={{ fontSize: 11, fontWeight: 600, fill: "var(--gris-texto)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
