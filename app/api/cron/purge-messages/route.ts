import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Retención de mensajería: elimina mensajes (y sus message_recipients) con más de
// RETENTION_DAYS de antigüedad. Pensado para correr como Vercel Cron (ver vercel.json).
// Se ejecuta con service role (sin sesión de usuario), por lo que salta RLS a propósito.
const RETENTION_DAYS = 180;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`. Sin el secreto correcto, 401.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  const { data: oldMsgs, error: selErr } = await supabase
    .from("messages")
    .select("id")
    .lt("created_at", cutoff);
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  const ids = ((oldMsgs ?? []) as { id: string }[]).map((m) => m.id);
  if (ids.length === 0) return NextResponse.json({ purged: 0 });

  // Borrar destinatarias primero por la FK (sin cascade).
  const { error: rErr } = await supabase.from("message_recipients").delete().in("message_id", ids);
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const { error: mErr } = await supabase.from("messages").delete().in("id", ids);
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({ purged: ids.length, retentionDays: RETENTION_DAYS });
}
