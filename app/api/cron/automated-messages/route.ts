import { NextResponse } from "next/server";
import { serverToday } from "@/lib/content/server-today";
import { evaluateNotices } from "@/lib/admin/notice-rules";
import {
  claimNotice,
  getAdminSenderId,
  getAgendarCells,
  getNoticeCandidates,
  getNoticeTemplates,
  getSentKeys,
  insertNoticeMessage,
} from "@/lib/admin/notice-queries";
import { sendNewMessageEmailBatch } from "@/lib/email/send";

/**
 * Mensajes automáticos (A4). Corre a diario como Vercel Cron (ver vercel.json).
 *
 * Dos reglas: recordatorio de agenda (primer día de una ventana "agendar") y
 * aviso de inactividad (≥10 días sin registrar). La decisión completa vive en
 * lib/admin/notice-rules.ts (pura y testeada); esta ruta sólo autentica,
 * orquesta y reporta.
 *
 * ⚠ Es el primer camino del código que envía correo a todas las clientas sin
 * que nadie pulse un botón. De ahí las tres protecciones: `?dryRun=1`, un tope
 * por corrida y el interruptor `is_active` de cada plantilla.
 */

export const dynamic = "force-dynamic";

/**
 * Tope de seguridad por corrida. En régimen normal se esperan unos pocos
 * avisos al día; un número muy superior significa que una regla se evaluó como
 * verdadera para casi todo el padrón (típicamente un error de fechas), y en ese
 * caso conviene no enviar nada y avisar.
 */
const MAX_NOTICES_PER_RUN = 50;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const now = serverToday();

  const templates = await getNoticeTemplates();
  if (!templates) {
    return NextResponse.json({ error: "No se pudieron leer las plantillas" }, { status: 500 });
  }

  const [cells, candidates] = await Promise.all([getAgendarCells(), getNoticeCandidates(now)]);

  let sentKeys: Set<string>;
  try {
    sentKeys = await getSentKeys(candidates.map((c) => c.profile_id));
  } catch {
    // Sin el ledger no se puede deduplicar; enviar a ciegas reenviaría a todas.
    return NextResponse.json({ error: "No se pudo leer el ledger de avisos" }, { status: 500 });
  }

  const intents = evaluateNotices(candidates, cells, sentKeys, templates, now);

  if (intents.length > MAX_NOTICES_PER_RUN) {
    console.error(
      `[cron/automated-messages] ABORTADO: ${intents.length} avisos supera el tope de ${MAX_NOTICES_PER_RUN}`
    );
    return NextResponse.json(
      {
        error: "Demasiados avisos en una sola corrida; no se envió nada",
        wouldSend: intents.length,
        cap: MAX_NOTICES_PER_RUN,
      },
      { status: 500 }
    );
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      candidates: candidates.length,
      agendarCells: cells.size,
      wouldSend: intents.length,
      byRule: countByRule(intents.map((i) => i.rule)),
      detail: intents.map((i) => ({ profile_id: i.profile_id, rule: i.rule, period_key: i.period_key })),
    });
  }

  const senderId = await getAdminSenderId();
  const delivered: { email: string; subject: string; body: string }[] = [];
  let claimed = 0;
  let skipped = 0;

  for (const intent of intents) {
    // Reclamar ANTES de enviar: si la fila no entra, otra corrida ya lo mandó.
    const won = await claimNotice(intent.profile_id, intent.rule, intent.period_key);
    if (!won) {
      skipped += 1;
      continue;
    }
    claimed += 1;

    const ok = await insertNoticeMessage({
      senderId,
      profileId: intent.profile_id,
      subject: intent.subject,
      body: intent.body,
    });
    // El correo es best-effort y sólo acompaña al mensaje in-app: si el in-app
    // no se pudo escribir, no se manda un correo que apunta a algo inexistente.
    if (ok) delivered.push({ email: intent.email, subject: intent.subject, body: intent.body });
  }

  await sendNewMessageEmailBatch(delivered);

  return NextResponse.json({
    candidates: candidates.length,
    matched: intents.length,
    sent: delivered.length,
    claimed,
    skippedAlreadySent: skipped,
    byRule: countByRule(intents.map((i) => i.rule)),
  });
}

function countByRule(rules: string[]): Record<string, number> {
  return rules.reduce<Record<string, number>>((acc, r) => {
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});
}
