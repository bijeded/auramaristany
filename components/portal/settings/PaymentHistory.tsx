import Link from "next/link";
import type { AccountInvoice } from "@/lib/portal/account-queries";
import { STATUS_LABEL } from "@/lib/admin/payment-status";
import { dayLabel } from "@/lib/admin/date-helpers";

function formatMoney(mxn: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(mxn);
}

export function PaymentHistory({
  invoices, page, totalPages,
}: { invoices: AccountInvoice[]; page: number; totalPages: number }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <p className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>Aún no tienes pagos registrados.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex flex-col">
        {invoices.map((inv, i) => {
          const badge = STATUS_LABEL[inv.status] ?? STATUS_LABEL.void;
          return (
            <div key={`${inv.invoice_date}-${i}`} className="flex items-center justify-between gap-3 py-3"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--gris-linea)" }}>
              <div className="min-w-0">
                <p className="font-body text-sm font-medium truncate" style={{ color: "var(--negro)" }}>{inv.program_name}</p>
                <p className="font-body text-xs" style={{ color: "var(--gris-suave)" }}>{dayLabel(inv.invoice_date)}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-body text-sm font-medium" style={{ color: "var(--negro)" }}>{formatMoney(inv.amount_paid)}</span>
                <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: badge.bg, color: badge.color }}>
                  {badge.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between" style={{ marginTop: 14 }}>
          {page > 1 ? (
            <Link href={`/portal/settings?page=${page - 1}#pagos`} className="font-body text-sm" style={{ color: "var(--lavanda-dark)" }}>← Anterior</Link>
          ) : <span />}
          <span className="font-body text-xs" style={{ color: "var(--gris-suave)" }}>Página {page} de {totalPages}</span>
          {page < totalPages ? (
            <Link href={`/portal/settings?page=${page + 1}#pagos`} className="font-body text-sm" style={{ color: "var(--lavanda-dark)" }}>Siguiente →</Link>
          ) : <span />}
        </div>
      )}
    </div>
  );
}
