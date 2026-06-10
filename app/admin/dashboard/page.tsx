import {
  getActiveSubscriptions,
  getPaidInvoices,
  getPastDueCount,
  getRecentPayments,
} from "@/lib/admin/finance-queries";
import {
  computeMRR,
  computeRenewalsThisMonth,
  groupClientsByVariant,
  groupRevenueByMonth,
  groupRevenueByProgram,
  formatMXN,
} from "@/lib/admin/finance-helpers";
import { RevenueBarChart } from "@/components/admin/RevenueBarChart";
import { ProgramRevenueDonut } from "@/components/admin/ProgramRevenueDonut";

const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  paid: { text: "Pagado", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  open: { text: "Pendiente", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  void: { text: "Anulado", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  uncollectible: { text: "Fallido", bg: "var(--error-tint)", color: "var(--error)" },
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, danger, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; danger?: boolean; href?: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <div className="font-body" style={{ fontWeight: 500, fontSize: 12.5, marginBottom: 10, color: "var(--gris-texto)" }}>{label}</div>
      <span className="font-head" style={{ fontSize: 30, fontWeight: 600, color: danger ? "var(--error)" : "var(--negro)" }}>{value}</span>
      {sub && (
        <div className="font-body" style={{ marginTop: 8, fontSize: 12, color: danger ? "var(--error)" : "var(--gris-texto)" }}>
          {href ? <a href={href} style={{ color: "inherit", textDecoration: "none" }}>{sub}</a> : sub}
        </div>
      )}
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const [activeSubs, invoices, pastDue, recent] = await Promise.all([
    getActiveSubscriptions(),
    getPaidInvoices(12),
    getPastDueCount(),
    getRecentPayments(10),
  ]);

  const mrr = computeMRR(activeSubs);
  const renewals = computeRenewalsThisMonth(activeSubs, now);
  const byMonth = groupRevenueByMonth(invoices, 12, now);
  const clientsByVariant = groupClientsByVariant(activeSubs);
  const revenueByProgram = groupRevenueByProgram(invoices);
  const maxClients = Math.max(1, ...clientsByVariant.map((p) => p.count));
  const rawMonth = now.toLocaleDateString("es-MX", { month: "long", year: "numeric" }); // "junio de 2026"
  const monthLabel = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1); // "Junio de 2026"

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1000 }}>
      <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
      <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 13, marginBottom: 20 }}>{monthLabel}</p>

      {/* KPIs */}
      <div className="flex" style={{ gap: 16, marginBottom: 18, alignItems: "stretch" }}>
        <Kpi label="Ingreso mensual recurrente" value={formatMXN(mrr)} sub={<em style={{ fontStyle: "italic" }}>*Estimado</em>} />
        <Kpi label="Suscripciones activas" value={String(activeSubs.length)} />
        <Kpi label="Renuevan este mes" value={String(renewals.count)} sub={formatMXN(renewals.amount)} />
        <Kpi label="Requieren atención" value={String(pastDue)} danger sub="Ver clientes →" href="/admin/clients" />
      </div>

      {/* Ingresos por mes */}
      <Card style={{ marginBottom: 18 }}>
        <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Ingresos por mes</h3>
        <RevenueBarChart data={byMonth} />
      </Card>

      {/* Distribución */}
      <div className="flex" style={{ gap: 16, marginBottom: 18, alignItems: "stretch" }}>
        <Card style={{ flex: 1 }}>
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Clientes por variante</h3>
          <div className="flex flex-col" style={{ gap: 16 }}>
            {clientsByVariant.length === 0 && <p className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>Sin suscripciones activas</p>}
            {clientsByVariant.map((p) => (
              <div key={p.variant}>
                <div className="flex" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="font-body" style={{ fontSize: 13, fontWeight: 600 }}>{p.variant}</span>
                  <span className="font-body" style={{ fontSize: 13, fontWeight: 600 }}>{p.count}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "var(--gris-claro)" }}>
                  <div style={{ height: 8, borderRadius: 4, width: `${(p.count / maxClients) * 100}%`, background: "#9982f4" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ flex: 1 }}>
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Ingresos por programa</h3>
          <ProgramRevenueDonut data={revenueByProgram} />
        </Card>
      </div>

      {/* Pagos recientes */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, padding: "18px 22px 12px" }}>Pagos recientes</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--gris-claro)" }}>
              {["Fecha", "Clienta", "Programa", "Monto", "Estado"].map((h) => (
                <th key={h} className="font-body" style={{ textAlign: h === "Monto" ? "right" : "left", padding: "10px 22px", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr><td colSpan={5} className="font-body" style={{ padding: "20px 22px", fontSize: 13, color: "var(--gris-texto)" }}>Aún no hay pagos registrados</td></tr>
            )}
            {recent.map((p, i) => {
              const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.open;
              return (
                <tr key={i} style={{ borderTop: "1px solid var(--gris-linea)" }}>
                  <td className="font-body" style={{ padding: "13px 22px", fontSize: 13.5, color: "var(--gris-texto)" }}>
                    {new Date(p.invoice_date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="font-body" style={{ padding: "13px 22px", fontSize: 13.5, fontWeight: 600 }}>{p.client_name}</td>
                  <td className="font-body" style={{ padding: "13px 22px", fontSize: 13.5, color: "var(--gris-texto)" }}>{p.program_name}</td>
                  <td className="font-body" style={{ padding: "13px 22px", fontSize: 13.5, fontWeight: 600, textAlign: "right" }}>{formatMXN(p.amount_paid)}</td>
                  <td style={{ padding: "13px 22px" }}>
                    <span className="font-body" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.color }}>{s.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
