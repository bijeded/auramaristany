import type { AccountSubscription } from "@/lib/portal/account-queries";
import { accountProgressLabel } from "@/lib/portal/account-queries";
import { repeatMarker } from "@/lib/portal/progress-display";
import { longDateLabel } from "@/lib/admin/date-helpers";

const STATUS_BADGE: Record<string, { text: string; bg: string; color: string }> = {
  active: { text: "Activa", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  trialing: { text: "Prueba", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  past_due: { text: "Pago pendiente", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  canceled: { text: "Cancelada", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  unpaid: { text: "Sin pagar", bg: "var(--error-tint)", color: "var(--error)" },
  // L2c — terminar es un logro, no una baja. Sin esta entrada caía al fallback
  // `canceled` y le decía "Cancelada" a quien acaba de completar el programa.
  completed: { text: "Completada", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
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
  // Una suscripción terminada ya no cobra: su cancelación está programada a fin
  // de periodo. Anunciar un "Próximo cobro" le diría que le van a volver a
  // cobrar justo debajo del cartel que celebra que terminó.
  const isCompleted = subscription.status === "completed";
  const progress = accountProgressLabel(subscription);
  const repeat = repeatMarker(subscription.content_loops, subscription.content_ordinal);

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
        isCompleted ? (
          <Row label="Tu acceso termina el">
            {longDateLabel(subscription.current_period_end)}
          </Row>
        ) : (
          <Row label="Próximo cobro">
            {longDateLabel(subscription.current_period_end)} · {formatMoney(subscription.price_mxn)}
          </Row>
        )
      )}
      {/* §6.4 — la fila "Programa" nombra la variante que PAGA; ésta, el nivel
          en el que ENTRENA. Pueden diferir en cuanto sube de peldaño, así que
          va rotulada: "Principiante" arriba y "Avanzado · Mes 2" abajo sin
          etiqueta se lee como una contradicción. */}
      <div style={{ marginTop: 16 }}>
        <p className="font-body text-xs" style={{ marginBottom: 4, color: "var(--gris-texto)" }}>
          {/* Sirve para las dos formas: "Avanzado · Mes 2" y "Mes 3 de 6". */}
          Mi progreso
        </p>
        <div className="flex justify-between" style={{ marginBottom: 6 }}>
          <span className="font-body text-xs font-semibold" style={{ color: "var(--negro)" }}>{progress.text}</span>
          {/* Sin duración no hay contra qué medir: se muestra la posición sin barra. */}
          {progress.percent !== null && (
            <span className="font-body text-xs" style={{ color: "var(--gris-suave)" }}>{progress.percent}%</span>
          )}
        </div>
        {progress.percent !== null && (
          <div style={{ height: 6, borderRadius: 999, background: "var(--gris-linea)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress.percent}%`, background: "var(--lavanda)" }} />
          </div>
        )}
        {repeat && (
          <p className="font-body text-xs" style={{ marginTop: 6, color: "var(--gris-suave)" }}>{repeat}</p>
        )}
      </div>
    </div>
  );
}
