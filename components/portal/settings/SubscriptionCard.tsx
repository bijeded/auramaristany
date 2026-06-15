import type { AccountSubscription } from "@/lib/portal/account-queries";
import { progressLabel } from "@/lib/portal/account-queries";
import { longDateLabel } from "@/lib/admin/date-helpers";

const STATUS_BADGE: Record<string, { text: string; bg: string; color: string }> = {
  active: { text: "Activa", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  trialing: { text: "Prueba", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  past_due: { text: "Pago pendiente", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  canceled: { text: "Cancelada", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  unpaid: { text: "Sin pagar", bg: "var(--error-tint)", color: "var(--error)" },
};

function formatMoney(mxn: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(mxn);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 items-center" style={{ marginBottom: 12 }}>
      <span className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>{label}</span>
      <span className="font-body text-sm font-medium text-right" style={{ color: "var(--negro)" }}>{children}</span>
    </div>
  );
}

export function SubscriptionCard({ subscription }: { subscription: AccountSubscription | null }) {
  if (!subscription) {
    return (
      <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <p className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>
          No tienes una suscripción activa.
        </p>
      </div>
    );
  }

  const badge = STATUS_BADGE[subscription.status] ?? STATUS_BADGE.canceled;
  const progress = progressLabel(subscription.months_elapsed, subscription.duration_months);

  return (
    <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <Row label="Programa">
        <span className="flex flex-col items-end gap-1">
          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: "var(--lavanda-tint)", color: "var(--lavanda-dark)", whiteSpace: "nowrap" }}>
            {subscription.program_name}
          </span>
          <span className="font-body text-xs" style={{ color: "var(--gris-suave)" }}>
            {subscription.variant_name}
          </span>
        </span>
      </Row>
      <Row label="Estado">
        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ background: badge.bg, color: badge.color }}>
          {badge.text}
        </span>
      </Row>
      <Row label="Fecha de inicio">{longDateLabel(subscription.enrollment_date)}</Row>
      {subscription.current_period_end && (
        <Row label="Próximo cobro">
          {longDateLabel(subscription.current_period_end)} · {formatMoney(subscription.price_mxn)}
        </Row>
      )}
      {progress && (
        <div style={{ marginTop: 16 }}>
          <div className="flex justify-between" style={{ marginBottom: 6 }}>
            <span className="font-body text-xs font-semibold" style={{ color: "var(--negro)" }}>{progress.text}</span>
            <span className="font-body text-xs" style={{ color: "var(--gris-suave)" }}>{progress.percent}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--gris-linea)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress.percent}%`, background: "var(--lavanda)" }} />
          </div>
        </div>
      )}
    </div>
  );
}
