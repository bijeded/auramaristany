"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMXN, filterPaymentsByStatus, type PaymentRow, type PaymentStatusFilter } from "@/lib/admin/finance-helpers";
import { paginate } from "@/lib/admin/pagination";
import { STATUS_LABEL } from "@/lib/admin/payment-status";

const STATUS_FILTERS: { key: PaymentStatusFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "paid", label: "Pagado" },
  { key: "open", label: "Pendiente" },
  { key: "void", label: "Anulado" },
  { key: "uncollectible", label: "Fallido" },
];

function paymentDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const [status, setStatus] = useState<PaymentStatusFilter>("todos");
  const [page, setPage] = useState(1);

  const filtered = filterPaymentsByStatus(rows, status);
  const { items, totalPages, page: current } = paginate(filtered, page);

  function setFilter(s: PaymentStatusFilter) {
    setStatus(s);
    setPage(1);
  }

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1040 }}>
      <Link href="/admin/dashboard" className="font-body" style={{ color: "var(--lavanda)", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 14 }}>
        ← Dashboard
      </Link>

      <h1 className="font-head" style={{ fontSize: 28, fontWeight: 700, marginBottom: 20 }}>
        Pagos <span style={{ fontSize: 17, color: "var(--gris-texto)", fontWeight: 400 }}>({rows.length})</span>
      </h1>

      {/* Filtros por estado */}
      <div className="flex gap-2 flex-wrap" style={{ marginBottom: 20 }}>
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} className={"pill " + (status === f.key ? "active" : "")} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>
            {rows.length === 0 ? "Aún no hay pagos registrados." : "No hay pagos con ese estado."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--gris-claro)" }}>
                {["Fecha", "Clienta", "Programa", "Monto", "Estado"].map((h) => (
                  <th key={h} className="font-body" style={{ textAlign: h === "Monto" ? "right" : "left", padding: "12px 20px", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.map((p, i) => {
                  const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.open;
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--gris-linea)" }}>
                      <td className="font-body" style={{ padding: "13px 20px", fontSize: 13.5, color: "var(--gris-texto)" }}>{paymentDate(p.invoice_date)}</td>
                      <td className="font-body" style={{ padding: "13px 20px", fontSize: 13.5, fontWeight: 600 }}>
                        {p.profile_id ? (
                          <Link href={`/admin/clients/${p.profile_id}`} style={{ color: "var(--lavanda-dark)", textDecoration: "none" }}>{p.client_name}</Link>
                        ) : (
                          p.client_name
                        )}
                      </td>
                      <td className="font-body" style={{ padding: "13px 20px", fontSize: 13.5, color: "var(--gris-texto)" }}>{p.program_name} · {p.variant_name}</td>
                      <td className="font-body" style={{ padding: "13px 20px", fontSize: 13.5, fontWeight: 600, textAlign: "right" }}>{formatMXN(p.amount_paid)}</td>
                      <td style={{ padding: "13px 20px" }}>
                        <span className="font-body" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.color }}>{s.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
            <span className="font-body" style={{ fontSize: 12.5, color: "var(--gris-texto)" }}>
              Mostrando {(current - 1) * 10 + 1}–{Math.min(current * 10, filtered.length)} de {filtered.length}
            </span>
            <div className="flex gap-2">
              <button disabled={current <= 1} onClick={() => setPage(current - 1)}
                className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: current <= 1 ? "not-allowed" : "pointer", opacity: current <= 1 ? 0.5 : 1 }}>Anterior</button>
              <button disabled={current >= totalPages} onClick={() => setPage(current + 1)}
                className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: current >= totalPages ? "not-allowed" : "pointer", opacity: current >= totalPages ? 0.5 : 1 }}>Siguiente</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
