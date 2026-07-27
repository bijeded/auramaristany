import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverToday } from "@/lib/content/server-today";
import { candidatePeriodKeys, evaluateNotices } from "@/lib/cron/notice-rules";
import {
  NoticeQueryError,
  claimNotice,
  getAdminSenderId,
  getAgendarCells,
  getNoticeCandidates,
  getNoticeTemplates,
  getSentKeys,
  insertNoticeMessage,
} from "@/lib/cron/notice-queries";
import { sendNewMessageEmailBatch } from "@/lib/email/send";

/**
 * Mensajes automáticos (A4). Corre a diario como Vercel Cron (ver vercel.json).
 *
 * Dos reglas: recordatorio de agenda (primer día de una ventana "agendar") y
 * aviso de inactividad (≥10 días sin registrar). La decisión completa vive en
 * lib/cron/notice-rules.ts (pura y testeada); esta ruta sólo autentica,
 * orquesta y reporta.
 *
 * ⚠ Es el primer camino del código que envía correo a todas las clientas sin
 * que nadie pulse un botón. De ahí las tres protecciones: `?dryRun=1`, un tope
 * por corrida y el interruptor `is_active` de cada plantilla.
 */

export const dynamic = "force-dynamic";

/**
 * Tope de seguridad por corrida: si una regla se evalúa verdadera para una
 * porción implausible del padrón (típicamente un error de fechas), aborta sin
 * enviar nada.
 *
 * Configurable por entorno porque el valor correcto depende del tamaño del
 * padrón: con el tope fijo, crecer lo suficiente hacía que el cron abortara a
 * diario hasta tocar el código. La primera corrida real también es alta por
 * naturaleza (todas las claves son nuevas) — por eso se ejecuta antes con
 * `?dryRun=1`.
 */
const DEFAULT_CAP = 200;
const cap = (): number => {
  const raw = Number(process.env.AUTOMATED_MESSAGES_MAX_PER_RUN);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CAP;
};

/** Comparación en tiempo constante para no filtrar el secreto byte a byte. */
function secretMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const now = serverToday();
  const maxPerRun = cap();

  try {
    const templates = await getNoticeTemplates();
    if (!templates) {
      return NextResponse.json({ error: "No se pudieron leer las plantillas" }, { status: 500 });
    }

    const [cells, candidates] = await Promise.all([getAgendarCells(), getNoticeCandidates(now)]);
    const sentKeys = await getSentKeys(
      candidates.map((c) => c.profile_id),
      candidatePeriodKeys(candidates, now)
    );

    const intents = evaluateNotices(candidates, cells, sentKeys, templates, now);

    if (intents.length > maxPerRun) {
      console.error(
        `[cron/automated-messages] ABORTADO: ${intents.length} avisos supera el tope de ${maxPerRun}`
      );
      return NextResponse.json(
        {
          error: "Demasiados avisos en una sola corrida; no se envió nada",
          wouldSend: intents.length,
          cap: maxPerRun,
        },
        { status: 500 }
      );
    }

    if (dryRun) {
      // Sólo agregados. El detalle por clienta incluiría `period_key`, que para
      // la regla de inactividad ES su última fecha de actividad: datos de
      // comportamiento ligados a un profile_id, y CRON_SECRET lo conocen más
      // sistemas y personas que la service-role key.
      return NextResponse.json({
        dryRun: true,
        candidates: candidates.length,
        agendarCells: cells.size,
        wouldSend: intents.length,
        byRule: countByRule(intents.map((i) => i.rule)),
      });
    }

    const senderId = await getAdminSenderId();
    const delivered: { email: string; subject: string; body: string }[] = [];
    let claimed = 0;
    let alreadySent = 0;
    let failed = 0;

    for (const intent of intents) {
      // Reclamar ANTES de enviar: si la fila no entra, otra corrida ya lo mandó.
      const claim = await claimNotice(intent.profile_id, intent.rule, intent.period_key);
      if (claim === "already_sent") {
        alreadySent += 1;
        continue;
      }
      if (claim === "error") {
        failed += 1;
        continue;
      }
      claimed += 1;

      const ok = await insertNoticeMessage({
        senderId,
        profileId: intent.profile_id,
        subject: intent.subject,
        body: intent.body,
      });
      // El correo sólo acompaña al mensaje in-app: si el in-app no se pudo
      // escribir, no se manda un correo que apunta a algo inexistente.
      if (ok) delivered.push({ email: intent.email, subject: intent.subject, body: intent.body });
      else failed += 1;
    }

    await sendNewMessageEmailBatch(delivered);

    return NextResponse.json({
      candidates: candidates.length,
      matched: intents.length,
      sent: delivered.length,
      claimed,
      skippedAlreadySent: alreadySent,
      failed,
      byRule: countByRule(intents.map((i) => i.rule)),
    });
  } catch (e) {
    // Una lectura rota no debe reportarse como una corrida sana y vacía.
    if (e instanceof NoticeQueryError) {
      console.error("[cron/automated-messages]", e.message);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    console.error("[cron/automated-messages] fallo inesperado", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Fallo al procesar los avisos" }, { status: 500 });
  }
}

function countByRule(rules: string[]): Record<string, number> {
  return rules.reduce<Record<string, number>>((acc, r) => {
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});
}
