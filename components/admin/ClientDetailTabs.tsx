"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { formatMXN } from "@/lib/admin/finance-helpers";
import { subscriptionProgressLabel } from "@/lib/admin/clients-helpers";
import { dayLabel, monthLabel, monthKey } from "@/lib/admin/date-helpers";
import { normalizeWhatsappNumber, whatsappUrl } from "@/lib/admin/message-helpers";
import { ClientPhotosTab } from "./ClientPhotosTab";
import type { ClientDetail } from "@/lib/admin/clients-queries";

const TABS = [
  ["resumen", "Resumen"], ["onboarding", "Onboarding"], ["progreso", "Progreso"],
  ["fotos", "Fotos"], ["pagos", "Pagos"], ["mensajes", "Mensajes"],
] as const;

const PAY_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  paid: { label: "Pagado", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  open: { label: "Pendiente", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  void: { label: "Anulado", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  uncollectible: { label: "Fallido", bg: "var(--error-tint)", color: "var(--error)" },
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, padding: 20, ...style }}>{children}</div>;
}

export function ClientDetailTabs({ detail }: { detail: ClientDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("resumen");
  const [deleting, setDeleting] = useState(false);
  const phone = normalizeWhatsappNumber(detail.profile.phone);

  async function handleDelete() {
    if (!detail.canDelete.ok) return;
    if (!confirm(`¿Eliminar a ${detail.profile.full_name}? Se borrarán todos los datos, fotos y registros. Es irreversible.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/clients/${detail.profile.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/clients");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "No se pudo eliminar.");
      setDeleting(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px 40px", maxWidth: 920 }}>
      <Link href="/admin/clients" className="font-body" style={{ color: "var(--lavanda)", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 14 }}>
        ← Clientes
      </Link>

      <div className="flex items-center gap-4" style={{ marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700 }}>{detail.profile.full_name}</h1>
          <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>{detail.profile.email}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap" style={{ marginBottom: 22 }}>
        {TABS.map(([v, l]) => (
          <button key={v} className={"pill " + (tab === v ? "active" : "")} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {/* RESUMEN */}
      {tab === "resumen" && (
        <div className="flex gap-4" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
          <Card style={{ flex: 1, minWidth: 320 }}>
            {detail.subscriptions.length === 0 && (
              <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>Sin suscripciones.</p>
            )}
            {detail.subscriptions.map((s, i) => (
              <div key={s.id} style={{ marginBottom: i < detail.subscriptions.length - 1 ? 18 : 0 }}>
                <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{s.program_name} · {s.variant_name}</h3>
                {[
                  ["Fecha de inicio", dayLabel(s.enrollment_date)],
                  ["Progreso", subscriptionProgressLabel({ months_elapsed: s.months_elapsed }, { billing_model: s.billing_model, duration_months: s.duration_months })],
                  ["Próximo cobro", s.current_period_end ? `${dayLabel(s.current_period_end.slice(0, 10))} · ${formatMXN(s.price_mxn)}` : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between" style={{ marginBottom: 10 }}>
                    <span className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>{k}</span>
                    <span className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </Card>
          <Card style={{ width: 240, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", gap: 12 }}>
            <p className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>Envía un mensaje directo a {detail.profile.full_name.split(" ")[0]}.</p>
            <Link href="/admin/messages" className="font-body" style={{ background: "var(--lavanda)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
              Enviar mensaje
            </Link>
          </Card>
        </div>
      )}

      {tab === "resumen" && (
        <div style={{ marginTop: 24 }}>
          <button onClick={handleDelete} disabled={!detail.canDelete.ok || deleting}
            title={detail.canDelete.ok ? "Eliminar clienta" : detail.canDelete.reason}
            className="font-body flex items-center gap-2"
            style={{ background: detail.canDelete.ok ? "var(--error-tint)" : "var(--gris-claro)", color: detail.canDelete.ok ? "var(--error)" : "var(--gris-suave)", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 600, fontSize: 13.5, cursor: detail.canDelete.ok ? "pointer" : "not-allowed" }}>
            <Trash2 size={16} /> Eliminar
          </button>
          {!detail.canDelete.ok && (
            <p className="font-body" style={{ color: "var(--gris-suave)", fontSize: 12, marginTop: 6 }}>{detail.canDelete.reason}</p>
          )}
        </div>
      )}

      {/* ONBOARDING */}
      {tab === "onboarding" && (
        <Card>
          {detail.onboarding.length === 0 && <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>Sin respuestas de onboarding.</p>}
          {detail.onboarding.map((o, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)", marginBottom: 4 }}>{o.question}</div>
              <div className="font-body" style={{ fontWeight: 600, fontSize: 15 }}>{o.answer}</div>
            </div>
          ))}
        </Card>
      )}

      {/* PROGRESO */}
      {tab === "progreso" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {detail.progress.length === 0 ? (
            <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14, padding: 20 }}>Sin registros de entrenamiento.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--gris-claro)" }}>{["Fecha", "Día", "Estado", "Ejercicios"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "11px 20px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {detail.progress.map((p, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--gris-linea)" }}>
                    <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5 }}>{dayLabel(p.date)}</td>
                    <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--gris-texto)" }}>{p.title}{p.focus ? ` · ${p.focus}` : ""}</td>
                    <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5 }}>{p.completed ? "Completo" : "Parcial"}</td>
                    <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5 }}>{p.doneCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* FOTOS */}
      {tab === "fotos" && <ClientPhotosTab clientId={detail.profile.id} photos={detail.photos} />}

      {/* PAGOS */}
      {tab === "pagos" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {detail.payments.length === 0 ? (
            <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14, padding: 20 }}>Sin pagos registrados.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--gris-claro)" }}>{["Fecha", "Período", "Monto", "Estado"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "11px 20px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {detail.payments.map((p, i) => {
                  const st = PAY_STATUS[p.status] ?? { label: p.status, bg: "var(--gris-claro)", color: "var(--gris-texto)" };
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--gris-linea)" }}>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5 }}>{dayLabel(p.date.slice(0, 10))}</td>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--gris-texto)" }}>{monthLabel(monthKey(p.date.slice(0, 10)))}</td>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600 }}>{formatMXN(p.amount)}</td>
                      <td style={{ padding: "12px 20px" }}>
                        <span className="font-body" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* MENSAJES */}
      {tab === "mensajes" && (
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600 }}>Mensajes enviados</h3>
            <div className="flex gap-2">
              {phone && (
                <a href={whatsappUrl(phone)} target="_blank" rel="noopener noreferrer"
                  className="font-body" style={{ background: "#25D366", color: "#fff", borderRadius: 10, padding: "8px 12px", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                  Enviar WhatsApp
                </a>
              )}
              <Link href="/admin/messages" className="font-body" style={{ background: "var(--lavanda)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                + Nuevo mensaje
              </Link>
            </div>
          </div>
          {detail.messages.length === 0 ? (
            <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>Sin mensajes enviados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {detail.messages.map((m) => (
                <Card key={m.id} style={{ padding: 14 }}>
                  <div className="font-head" style={{ fontWeight: 600, fontSize: 15 }}>{m.subject}</div>
                  <div className="font-body" style={{ color: "var(--gris-suave)", fontSize: 12, marginTop: 2 }}>
                    {dayLabel(m.createdAt.slice(0, 10))} · {m.readAt ? "Leído" : "No leído"}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
