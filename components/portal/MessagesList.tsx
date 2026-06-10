"use client";

import Link from "next/link";
import type { InboxItem } from "@/lib/content/messages";
import { whatsappUrl } from "@/lib/admin/message-helpers";

export function MessagesList({ items, auraWhatsapp }: { items: InboxItem[]; auraWhatsapp: string | null }) {
  const unread = items.filter((m) => !m.read).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px 8px" }}>
        <h1 className="font-head" style={{ fontSize: 20, fontWeight: 700 }}>Mensajes</h1>
        {unread > 0 && (
          <span style={{ background: "var(--lavanda)", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
            {unread} nuevos
          </span>
        )}
      </div>

      {auraWhatsapp && (
        <div style={{ padding: "0 16px 8px" }}>
          <a href={whatsappUrl(auraWhatsapp, "Hola Aura 👋")} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#25D366", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 600, textDecoration: "none" }}>
            💬 Escríbele a Aura por WhatsApp
          </a>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px 24px" }}>
        {items.length === 0 ? (
          <p className="font-body" style={{ color: "var(--gris-suave)", textAlign: "center", marginTop: 40 }}>
            Cuando Aura te envíe algo, aparecerá aquí.
          </p>
        ) : (
          items.map((m) => (
            <Link key={m.id} href={`/portal/messages/${m.id}`}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", textDecoration: "none", color: "inherit",
                background: m.read ? "var(--gris-claro, #f4f1f1)" : "#fff",
                border: "1px solid " + (m.read ? "transparent" : "var(--gris-linea)"),
                borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--lavanda)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>A</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-head" style={{ fontWeight: 600, fontSize: 15, color: m.read ? "var(--gris-texto)" : "var(--negro)" }}>{m.subject}</div>
                <div className="font-body" style={{ fontSize: 13, color: "var(--gris-suave)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.preview}</div>
                <div style={{ fontSize: 11, color: "var(--gris-suave)", marginTop: 4 }}>{new Date(m.createdAt).toLocaleDateString("es-MX")}</div>
              </div>
              {!m.read && <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--lavanda)", flexShrink: 0, marginTop: 6 }} />}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
