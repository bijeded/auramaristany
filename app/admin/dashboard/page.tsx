import {
  getActiveSubscriptions,
  getPaidInvoices,
  getPastDueCount,
  getRecentPayments,
} from "@/lib/admin/finance-queries";
import {
  computeMRR,
  computeRenewalsWithinDays,
  partitionByOutcome,
  groupClientsByVariant,
  groupRevenueByMonth,
  groupRevenueByProgram,
  formatMXN,
} from "@/lib/admin/finance-helpers";
import { RevenueBarChart } from "@/components/admin/RevenueBarChart";
import { ProgramRevenueDonut } from "@/components/admin/ProgramRevenueDonut";
import Link from "next/link";
import { STATUS_LABEL } from "@/lib/admin/payment-status";
import { requireAdminPage } from "@/lib/admin/auth";

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, danger, success, href }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  danger?: boolean;
  /** D17 — verde de logro: terminar el plazo es graduarse, no perder a alguien. */
  success?: boolean;
  href?: string;
}) {
  const accent = danger ? "var(--error)" : success ? "var(--exito)" : undefined;
  return (
    <Card>
      <div className="font-body" style={{ fontWeight: 500, fontSize: 12.5, marginBottom: 10, color: "var(--gris-texto)" }}>{label}</div>
      <span className="font-head" style={{ fontSize: 30, fontWeight: 600, color: accent ?? "var(--negro)" }}>{value}</span>
      {sub && (
        <div className="font-body" style={{ marginTop: 8, fontSize: 12, color: accent ?? "var(--gris-texto)" }}>
          {href ? <a href={href} style={{ color: "inherit", textDecoration: "none" }}>{sub}</a> : sub}
        </div>
      )}
    </Card>
  );
}

/**
 * D17 — ventana rodante de las tres tarjetas de cohorte, en días.
 *
 * Rodante y no mes calendario: al renovar, `invoice.paid` empuja
 * `current_period_end` al mes siguiente, y al expirar una que termina pasa a
 * `canceled`/`completed` y sale del conjunto `active`. O sea que la mitad pasada
 * de cualquier mes está vacía por construcción, y un "mes calendario" sólo
 * podría significar "lo que falta", decayendo a cero cada día 28.
 */
const HORIZON_DAYS = 7;

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const now = new Date();
  const [activeSubs, invoices, pastDue, recent] = await Promise.all([
    getActiveSubscriptions(),
    getPaidInvoices(12),
    getPastDueCount(),
    getRecentPayments(10),
  ]);

  // D17 — la partición se hace UNA vez y de ella cuelgan las tres tarjetas de
  // ventana. `deriveCancellationState` decide la cohorte; aquí no se lee ninguna
  // bandera, que es justo lo que evita la cuarta copia de la misma derivación.
  const { billing, completing, cancelling } = partitionByOutcome(activeSubs);

  // El MRR sale SÓLO de `billing`: una suscripción que se está acabando no
  // producirá otro cobro, y sumarla era mostrarle a Aura dinero que no llega.
  const mrr = computeMRR(billing);

  // Las tres, sobre la MISMA ventana de 7 días, y cada etiqueta lo dice. El MRR
  // ya responde "el mes"; estas tarjetas responden "esta semana".
  const renewals = computeRenewalsWithinDays(billing, HORIZON_DAYS, now);
  const ending = computeRenewalsWithinDays(completing, HORIZON_DAYS, now);
  const cancellations = computeRenewalsWithinDays(cancelling, HORIZON_DAYS, now);

  const byMonth = groupRevenueByMonth(invoices, 12, now);
  // Headcount y variantes van sobre TODAS las activas, incluidas las que
  // terminan: siguen teniendo acceso al portal y siguen entrenando.
  const clientsByVariant = groupClientsByVariant(activeSubs);
  const revenueByProgram = groupRevenueByProgram(invoices);
  const maxClients = Math.max(1, ...clientsByVariant.map((p) => p.count));
  const dayMonth = now.toLocaleDateString("es-MX", { day: "numeric", month: "long" }); // "16 de junio"
  const dateLabel = `${dayMonth}, ${now.getFullYear()}`; // "16 de junio, 2026"

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1000 }}>
      <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
      <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 13, marginBottom: 20 }}>{dateLabel}</p>

      {/* KPIs */}
      {/* D17 — grid, no flex-wrap: con seis tarjetas el `flex: 1 1 150px` las
          apretaba a 150px de ancho en una sola fila (las etiquetas con
          "(próx. 7 días)" caían a tres líneas) y por debajo de 980px rompía en un
          5+1 desparejo. Con pistas de 300px mínimo el reparto es 3+3 en
          escritorio, 2+2+2 en tableta y 1 por fila en móvil: nunca desparejo. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          marginBottom: 18,
          alignItems: "stretch",
        }}
      >
        <Kpi label="Ingreso mensual recurrente" value={formatMXN(mrr)} sub={<em style={{ fontStyle: "italic" }}>*Estimado</em>} />
        <Kpi label="Suscripciones activas" value={String(activeSubs.length)} />
        <Kpi label="Renuevan (próx. 7 días)" value={String(renewals.count)} sub={formatMXN(renewals.amount)} />
        {/* Terminar el plazo es una GRADUACIÓN —toca ofrecerle Extra—, no una
            baja. Va en verde de logro, deliberadamente distinta de la de al
            lado, para que Aura no las lea como el mismo evento. */}
        <Kpi
          label="Terminan (próx. 7 días)"
          value={String(ending.count)}
          success
          sub="Ver clientes →"
          href="/admin/clients?status=%C3%9Altimo%20mes"
        />
        <Kpi
          label="Cancelaciones (próx. 7 días)"
          value={String(cancellations.count)}
          sub="Ver clientes →"
          href="/admin/clients?status=En%20cancelaci%C3%B3n"
        />
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
        <div className="flex items-center justify-between" style={{ padding: "18px 22px 12px" }}>
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600 }}>Pagos recientes</h3>
          <Link href="/admin/payments" className="font-body" style={{ color: "var(--lavanda)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Ver todos →</Link>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--gris-claro)" }}>
              {["Fecha", "Cliente", "Programa", "Monto", "Estado"].map((h) => (
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
