import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMessageDetail } from "@/lib/content/messages";
import { MarkReadOnView } from "@/components/portal/MarkReadOnView";

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const msg = await getMessageDetail(user.id, id);
  if (!msg) notFound();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <MarkReadOnView messageId={id} />
      <div style={{ padding: "16px 16px 8px" }}>
        <Link href="/portal/messages" style={{ color: "var(--gris-texto)", fontSize: 14, textDecoration: "none" }}>← Mensajes</Link>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 30px" }}>
        <h1 className="font-head" style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>{msg.subject}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--lavanda)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>A</div>
          <div>
            <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>Aura Maristany</div>
            <div style={{ fontSize: 12, color: "var(--gris-suave)" }}>{new Date(msg.createdAt).toLocaleDateString("es-MX")}</div>
          </div>
        </div>
        <p className="font-body" style={{ whiteSpace: "pre-line", fontSize: 15.5, lineHeight: "24px", color: "var(--negro)" }}>{msg.body}</p>
      </div>
    </div>
  );
}
