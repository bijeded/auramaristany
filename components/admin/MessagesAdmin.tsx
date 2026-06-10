"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SentMessage } from "@/lib/admin/queries";
import type { RecipientGroup } from "@/lib/admin/message-helpers";
import { whatsappUrl } from "@/lib/admin/message-helpers";
import { sendMessage, getSentMessageDetail, deleteMessage, type SentMessageDetail } from "@/lib/admin/messageActions";

export interface ClientOption {
  id: string;
  name: string;
  whatsapp: string | null;
}

type Mode = "individual" | "broadcast";

export function MessagesAdmin({
  sent,
  groups,
  clients,
}: {
  sent: SentMessage[];
  groups: RecipientGroup[];
  clients: ClientOption[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("broadcast");
  const [clientId, setClientId] = useState<string>("");
  const [allClients, setAllClients] = useState(true);
  const [variantIds, setVariantIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detalle de un mensaje enviado (ver / clonar / eliminar)
  const [detail, setDetail] = useState<SentMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  async function openDetail(id: string) {
    setDetailLoading(true);
    setConfirmDelete(false);
    const d = await getSentMessageDetail(id);
    setDetail(d);
    setDetailLoading(false);
  }

  function cloneToComposer() {
    if (!detail) return;
    setSubject(detail.subject);
    setBody(detail.body);
    setError(null);
    setDetail(null);
    setOpen(true);
  }

  async function handleDelete() {
    if (!detail) return;
    setDeleting(true);
    const res = await deleteMessage(detail.id);
    setDeleting(false);
    if (!res.ok) {
      setError(res.error ?? "Error al eliminar");
      return;
    }
    setDetail(null);
    setConfirmDelete(false);
    router.refresh();
  }

  const count =
    mode === "individual"
      ? clientId
        ? 1
        : 0
      : allClients
      ? clients.length
      : groups.filter((g) => variantIds.includes(g.variantId)).reduce((s, g) => s + g.count, 0);

  function toggleVariant(id: string) {
    setVariantIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  async function handleSend() {
    setError(null);
    setSending(true);
    const selection =
      mode === "individual"
        ? { mode: "individual" as const, profileId: clientId }
        : allClients
        ? { mode: "all" as const }
        : { mode: "groups" as const, variantIds };
    const res = await sendMessage({ subject, body, selection });
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? "Error al enviar");
      return;
    }
    setOpen(false);
    setSubject("");
    setBody("");
    setClientId("");
    setVariantIds([]);
    router.refresh();
  }

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 820 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700 }}>Mensajes</h1>
        <button onClick={() => setOpen(true)}
          style={{ background: "var(--lavanda)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}>
          + Nuevo mensaje
        </button>
      </div>

      {sent.length === 0 ? (
        <p className="font-body" style={{ color: "var(--gris-texto)" }}>Aún no has enviado mensajes.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sent.map((m) => (
            <button key={m.id} onClick={() => openDetail(m.id)}
              style={{ display: "flex", gap: 16, alignItems: "center", textAlign: "left", cursor: "pointer", width: "100%", background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 12, padding: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: m.isBroadcast ? "var(--lavanda-tint, #efeaff)" : "var(--rosa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {m.isBroadcast ? "📢" : "👤"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-head" style={{ fontWeight: 600, fontSize: 15 }}>{m.subject}</div>
                <div className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>Para: {m.destination}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "var(--gris-suave)" }}>
                <div>{new Date(m.createdAt).toLocaleDateString("es-MX")}</div>
                <div>{m.readLabel}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
          onClick={() => !sending && setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 className="font-head" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Nuevo mensaje</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["individual", "broadcast"] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                    border: "1.5px solid " + (mode === m ? "var(--lavanda)" : "var(--gris-linea)"),
                    background: mode === m ? "var(--lavanda-tint, #efeaff)" : "#fff", fontWeight: 600 }}>
                  {m === "individual" ? "👤 Individual" : "📢 Difusión"}
                </button>
              ))}
            </div>

            {mode === "individual" ? (
              <div style={{ marginBottom: 14 }}>
                <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Cliente</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--gris-linea)" }}>
                  <option value="">Selecciona…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {selectedClient?.whatsapp && (
                  <a href={whatsappUrl(selectedClient.whatsapp)} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-block", marginTop: 8, color: "#25D366", fontWeight: 600, fontSize: 13 }}>
                    💬 Escribir por WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Destinatarias</label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={allClients} onChange={(e) => setAllClients(e.target.checked)} />
                  <span className="font-body" style={{ fontWeight: 600 }}>Todos los clientes activos</span>
                </label>
                {!allClients && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                    {groups.map((g) => (
                      <label key={g.variantId} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid var(--gris-linea)", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>
                        <input type="checkbox" checked={variantIds.includes(g.variantId)} onChange={() => toggleVariant(g.variantId)} />
                        <span className="font-body" style={{ flex: 1, fontSize: 14 }}>{g.label}</span>
                        <span style={{ fontSize: 12, color: "var(--gris-suave)" }}>{g.count}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Asunto</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Escribe el asunto…"
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--gris-linea)" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Mensaje</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu mensaje…"
                style={{ width: "100%", minHeight: 120, padding: 10, borderRadius: 8, border: "1px solid var(--gris-linea)", resize: "vertical" }} />
            </div>

            {error && <p style={{ color: "var(--error, #c0392b)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
                Se enviará a <strong>{count}</strong> cliente{count !== 1 ? "s" : ""}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setOpen(false)} disabled={sending}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--gris-linea)", background: "#fff", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={handleSend} disabled={sending || count === 0 || !subject.trim() || !body.trim()}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "var(--lavanda)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: sending || count === 0 ? 0.6 : 1 }}>
                  {sending ? "Enviando…" : "Enviar ahora"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(detail || detailLoading) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
          onClick={() => {
            if (deleting) return;
            setDetail(null);
            setDetailLoading(false);
            setConfirmDelete(false);
          }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            {detailLoading || !detail ? (
              <p className="font-body" style={{ color: "var(--gris-texto)" }}>Cargando…</p>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                  <h2 className="font-head" style={{ fontSize: 20, fontWeight: 700 }}>{detail.subject}</h2>
                  <span style={{ fontSize: 12, color: "var(--gris-suave)", whiteSpace: "nowrap" }}>
                    {detail.isBroadcast ? "📢 Difusión" : "👤 Individual"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--gris-suave)", marginBottom: 14 }}>
                  {new Date(detail.createdAt).toLocaleString("es-MX")}
                </div>
                <p className="font-body" style={{ whiteSpace: "pre-line", fontSize: 15, lineHeight: "23px", color: "var(--negro)", marginBottom: 18 }}>{detail.body}</p>

                <div className="font-body" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Destinatarias ({detail.recipients.filter((r) => r.read).length} de {detail.recipients.length} leído{detail.recipients.length === 1 ? "" : "s"})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20, maxHeight: 200, overflowY: "auto" }}>
                  {detail.recipients.map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--gris-linea)" }}>
                      <span className="font-body">{r.name}</span>
                      <span style={{ color: r.read ? "var(--lavanda)" : "var(--gris-suave)", fontWeight: 600 }}>
                        {r.read ? "✓ Leído" : "Sin leer"}
                      </span>
                    </div>
                  ))}
                </div>

                {error && <p style={{ color: "var(--error, #c0392b)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

                {confirmDelete ? (
                  <div style={{ background: "var(--rosa, #f8eeec)", borderRadius: 10, padding: 14 }}>
                    <p className="font-body" style={{ fontSize: 13, marginBottom: 10 }}>
                      Esto elimina el mensaje y lo quita de la bandeja de los clientes. No se puede deshacer.
                    </p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--gris-linea)", background: "#fff", cursor: "pointer" }}>
                        Cancelar
                      </button>
                      <button onClick={handleDelete} disabled={deleting}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--error, #c0392b)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
                        {deleting ? "Eliminando…" : "Sí, eliminar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setConfirmDelete(true)}
                      style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--error, #c0392b)", background: "#fff", color: "var(--error, #c0392b)", fontWeight: 600, cursor: "pointer" }}>
                      Eliminar
                    </button>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setDetail(null); setConfirmDelete(false); }}
                        style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--gris-linea)", background: "#fff", cursor: "pointer" }}>
                        Cerrar
                      </button>
                      <button onClick={cloneToComposer}
                        style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "var(--lavanda)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                        Clonar para reenviar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
