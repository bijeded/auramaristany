import {
  getActiveSubscriptions,
  getCancellationReasonsAllTime,
  getChurnByVariantAllTime,
  getPaidInvoices,
  getPastDueCount,
  getRecentPayments,
  getRevenueByVariantAllTime,
} from "@/lib/admin/finance-queries";
import {
  computeMRR,
  computeRenewalsWithinDays,
  countWithShare,
  partitionByOutcome,
  groupCancellationReasons,
  groupChurnByVariant,
  groupClientsByVariant,
  groupRevenueByMonth,
  groupRevenueByVariant,
  orderRevenueByClientsOrder,
  formatMXN,
} from "@/lib/admin/finance-helpers";
import { RevenueBarChart } from "@/components/admin/RevenueBarChart";
import { VariantBarList } from "@/components/admin/VariantBarList";
import Link from "next/link";
import { STATUS_LABEL } from "@/lib/admin/payment-status";
import { requireAdminPage } from "@/lib/admin/auth";
import { COHORT_FILTER } from "@/lib/admin/clients-helpers";

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, danger, accent, href }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  danger?: boolean;
  /**
   * D17 — color del numeral. Cada cohorte que termina lleva el suyo: verde de
   * logro para quien se gradúa (toca ofrecerle Extra) y ámbar para quien se va.
   * Se usan los tokens legibles como texto (--exito-text, no --exito): el verde
   * de los fondos teñidos no llega ni al 3:1 que pide una cifra grande.
   * Sin esto las dos se leían como el mismo evento, y una buena racha de
   * graduaciones parecía fuga de clientes.
   */
  accent?: string;
  href?: string;
}) {
  const hue = danger ? "var(--error)" : accent;
  return (
    <Card>
      <div className="font-body" style={{ fontWeight: 500, fontSize: 12.5, marginBottom: 10, color: "var(--gris-texto)" }}>{label}</div>
      {/* El acento va SÓLO en el numeral (30px): a 12px estos tonos no dan
          contraste suficiente, así que el subtítulo se queda en gris legible y el
          estado nunca depende del color a solas — lo dice la etiqueta. */}
      <span className="font-head" style={{ fontSize: 30, fontWeight: 600, color: hue ?? "var(--negro)" }}>{value}</span>
      {sub && (
        <div className="font-body" style={{ marginTop: 8, fontSize: 12, color: "var(--gris-texto)" }}>
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

/**
 * Enlace a la cohorte en el listado de clientes.
 *
 * La etiqueta viene de `COHORT_FILTER`, la misma que pinta la pill y contra la
 * que valida `parseStatusFilter`: escrita a mano aquí sería una tercera copia, y
 * renombrar la pill dejaría el enlace apuntando a un filtro inexistente.
 *
 * OJO — el enlace NO lleva la ventana de 7 días: la pill filtra por cohorte, sin
 * horizonte. La tarjeta dice cuántas terminan esta semana y el listado muestra
 * todas las de esa cohorte, así que puede traer más filas que el número de la
 * tarjeta. De ahí "Ver todas" en vez de "Ver clientes": la lista es un
 * superconjunto a propósito, no una discrepancia.
 */
function cohortHref(label: string): string {
  return `/admin/clients?status=${encodeURIComponent(label)}`;
}

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const now = new Date();
  const [activeSubs, invoices, pastDue, recent, variantInvoices, churnSubs, reasonSurveys] =
    await Promise.all([
      getActiveSubscriptions(),
      getPaidInvoices(12),
      getPastDueCount(),
      getRecentPayments(10),
      getRevenueByVariantAllTime(),
      getChurnByVariantAllTime(),
      getCancellationReasonsAllTime(),
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

  // Ingreso histórico completo, ordenado contra la tarjeta de clientes. Las dos
  // listas pueden diferir en largo y en miembros: una variante puede tener
  // clientes y no haber facturado todavía, u otra haber facturado y no tener ya
  // ningún cliente activo. Es la divergencia de ADR 0004 hecha visible, no un
  // desajuste que haya que cuadrar.
  const revenueByVariant = orderRevenueByClientsOrder(
    groupRevenueByVariant(variantInvoices),
    clientsByVariant
  );
  const revenueTotal = revenueByVariant.reduce((sum, r) => sum + r.total, 0);

  // Las dos cartas de fuga. Cada una sale de SU consulta y no se cuadran entre
  // sí a propósito: la de variante cuenta filas de `subscriptions` y la de
  // motivos cuenta filas de encuesta, que sobreviven al borrado de su
  // suscripción (`on delete set null`). Es la misma divergencia deliberada de
  // ADR 0004 que ya tienen "Clientes" e "Ingresos" por variante, y por eso cada
  // carta dice sobre qué población saca su porcentaje.
  const churnByVariant = groupChurnByVariant(churnSubs);
  const cancellationReasons = groupCancellationReasons(reasonSurveys);
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
          5+1 desparejo. Con pistas de 288px el reparto es 3+3 en escritorio,
          2+2+2 en tableta y 1 por fila en móvil: nunca desparejo. 288 y no 300
          porque el ancho útil son 936px (1000 menos 32 de padding a cada lado,
          border-box por el preflight de Tailwind) y tres pistas de 300 + 32 de
          hueco caben por 4px: cualquier ajuste de padding lo volcaría a 2+2+2. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(288px, 1fr))",
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
          accent="var(--exito-text)"
          sub="Ver todas →"
          href={cohortHref(COHORT_FILTER.completing)}
        />
        <Kpi
          label="Cancelaciones (próx. 7 días)"
          value={String(cancellations.count)}
          accent="var(--ambar)"
          sub="Ver todas →"
          href={cohortHref(COHORT_FILTER.cancelling)}
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
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Clientes por variante</h3>
          {/* Las dos tarjetas llevan encabezado de la misma altura (título +
              línea de ventana) para que las primeras filas arranquen a la misma
              altura. Si una tuviera subtítulo y la otra no, el desfase anularía
              justo la lectura fila-contra-fila que el orden compartido busca. */}
          <p className="font-body" style={{ fontSize: 12, color: "var(--gris-texto)", marginBottom: 16 }}>
            Suscripciones activas hoy
          </p>
          <VariantBarList
            rows={clientsByVariant.map((p) => ({ label: p.variant, value: p.count, display: String(p.count) }))}
            fill="var(--lavanda-dark)"
            emptyMessage="Sin suscripciones activas"
          />
        </Card>
        <Card style={{ flex: 1 }}>
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>
            Ingresos por variante {revenueByVariant.length > 0 && <>· {formatMXN(revenueTotal)}</>}
          </h3>
          {/* La ventana va dicha, no implícita: la tarjeta de al lado es una foto
              de hoy y ésta es el acumulado de siempre. Sin la línea, dos listas
              con el mismo eje parecen cubrir el mismo periodo. */}
          <p className="font-body" style={{ fontSize: 12, color: "var(--gris-texto)", marginBottom: 16 }}>
            Histórico completo
          </p>
          <VariantBarList
            rows={revenueByVariant.map((r) => ({ label: r.variant, value: r.total, display: formatMXN(r.total) }))}
            fill="var(--rosa-bar)"
            emptyMessage="Aún no hay pagos registrados"
          />
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

      {/* Cancelaciones — el par de fuga.
          Mismo esqueleto que el par de variantes de arriba (título + línea de
          población, encabezados de la misma altura) para que las primeras filas
          arranquen parejas.
          Los subtítulos NO son adorno: las dos cartas enseñan "N (%)" y los dos
          porcentajes miden cosas distintas —el de la izquierda es una TASA sobre
          quienes se suscribieron y el de la derecha una PARTE del total, que sí
          suma 100%—. Sin la línea, lado a lado invitan justo a la comparación
          equivocada. */}
      <div className="flex" style={{ gap: 16, marginTop: 18, alignItems: "stretch" }}>
        <Card style={{ flex: 1 }}>
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Cancelaciones por variante</h3>
          <p className="font-body" style={{ fontSize: 12, color: "var(--gris-texto)", marginBottom: 16 }}>
            Histórico completo · % de quienes se suscribieron
          </p>
          {/* La barra la escala el CONTEO, no la tasa: la carta ordena por
              volumen y el porcentaje aporta el contexto que el volumen esconde.
              3 bajas de 40 y 3 de 4 empatan por conteo y son problemas
              distintos. */}
          <VariantBarList
            rows={churnByVariant.map((c) => ({
              label: c.variant,
              value: c.churned,
              display: countWithShare(c.churned, c.rate),
            }))}
            fill="var(--ambar)"
            emptyMessage="Nadie ha cancelado todavía"
          />
        </Card>
        <Card style={{ flex: 1 }}>
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Razones de cancelación</h3>
          <p className="font-body" style={{ fontSize: 12, color: "var(--gris-texto)", marginBottom: 16 }}>
            Histórico completo · % del total de cancelaciones
          </p>
          <VariantBarList
            rows={cancellationReasons.map((r) => ({
              label: r.label,
              value: r.count,
              display: countWithShare(r.count, r.share),
            }))}
            fill="var(--ciruela-bar)"
            emptyMessage="Aún no hay motivos registrados"
          />
        </Card>
      </div>
    </div>
  );
}
