import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentSeriesNumber } from "@/lib/content/access";
import { ACCESS_STATES } from "@/lib/content/subscription-access";
import { agendarCellKey, sentKey, type NoticeCandidate, type NoticeTemplates } from "./notice-rules";
import type { NoticeRule } from "@/lib/supabase/types";

/**
 * Lecturas y escrituras del cron de mensajes automáticos (A4).
 *
 * Todo corre con **service-role**: el cron no tiene sesión de usuario (mismo
 * patrón que purge-messages). `automated_notices` además tiene RLS forzada sin
 * políticas, así que service-role es el ÚNICO acceso posible — ni siquiera un
 * admin puede leer el ledger.
 *
 * Sólo dos consultas para todo el padrón: el conjunto de celdas con bloque
 * "agendar" es diminuto y compartido, así que se lee una vez y las candidatas
 * se resuelven en memoria contra un Set.
 */

// --- 1) Celdas con ventana de agenda -------------------------------------

/**
 * Todas las celdas (serie, semana, día) que exponen un bloque "agendar" en un
 * día PUBLICADO. El filtro de publicación importa: un día sin publicar no lo ve
 * la clienta, así que el aviso no debe anunciar una ventana invisible.
 */
export async function getAgendarCells(): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("program_day_blocks")
    .select("program_days!inner ( series_id, week_number, day_of_week, published )")
    .eq("block_type", "agendar")
    .eq("program_days.published", true);

  if (error) {
    console.error("[notice-queries] getAgendarCells:", error.message);
    return new Set();
  }

  // keep: program_day_blocks JOIN program_days!inner — join shape not inferred by the SDK.
  type Row = {
    program_days: { series_id: string; week_number: number; day_of_week: string } | null;
  };

  const cells = new Set<string>();
  for (const row of (data ?? []) as Row[]) {
    const d = row.program_days;
    if (d?.series_id) cells.add(agendarCellKey(d.series_id, d.week_number, d.day_of_week));
  }
  return cells;
}

// --- 2) Candidatas --------------------------------------------------------

/**
 * Clientas con suscripción que concede acceso, con todo lo que las reglas
 * necesitan: periodo vigente, serie del mes ya resuelta, última actividad y si
 * tienen una llamada futura.
 *
 * `series_id` se resuelve aquí (variante + months_elapsed → variant_series_map)
 * para que la capa de reglas siga siendo pura: allí sólo se consultan Sets.
 */
export async function getNoticeCandidates(now: Date): Promise<NoticeCandidate[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `profile_id, status, cancel_at_period_end, current_period_start, enrollment_date,
       months_elapsed, program_variant_id,
       profiles!inner ( email, full_name, progress_logs ( log_date ), bookings ( scheduled_at, status ) )`
    )
    .in("status", ACCESS_STATES);

  if (error) {
    console.error("[notice-queries] getNoticeCandidates:", error.message);
    return [];
  }

  // keep: subscriptions JOIN profiles!inner (+ progress_logs, bookings) — nested join
  // shape not inferred by the SDK without Relationships in the Database type.
  type Row = {
    profile_id: string;
    status: string;
    cancel_at_period_end: boolean | null;
    current_period_start: string | null;
    enrollment_date: string;
    months_elapsed: number;
    program_variant_id: string;
    profiles: {
      email: string;
      full_name: string | null;
      progress_logs: { log_date: string }[] | null;
      bookings: { scheduled_at: string; status: string }[] | null;
    } | null;
  };

  const rows = ((data ?? []) as unknown as Row[]).filter(
    (r) => r.profiles && r.current_period_start
  );
  if (rows.length === 0) return [];

  const seriesByVariant = await getSeriesByVariantAndNumber(
    Array.from(new Set(rows.map((r) => r.program_variant_id)))
  );

  const nowMs = now.getTime();

  return rows.map((r) => {
    const logs = r.profiles!.progress_logs ?? [];
    const lastActivity = logs.reduce<string | null>(
      (max, l) => (max === null || l.log_date > max ? l.log_date : max),
      null
    );

    const bookings = r.profiles!.bookings ?? [];
    const hasFutureCall = bookings.some(
      (b) => b.status === "active" && new Date(b.scheduled_at).getTime() > nowMs
    );

    const seriesNumber = getCurrentSeriesNumber(r.months_elapsed);
    const seriesId = seriesByVariant.get(`${r.program_variant_id}|${seriesNumber}`) ?? null;

    return {
      profile_id: r.profile_id,
      email: r.profiles!.email,
      full_name: r.profiles!.full_name,
      status: r.status as NoticeCandidate["status"],
      cancel_at_period_end: r.cancel_at_period_end === true,
      current_period_start: r.current_period_start!,
      enrollment_date: r.enrollment_date,
      series_id: seriesId,
      last_activity_date: lastActivity,
      has_future_call: hasFutureCall,
    } satisfies NoticeCandidate;
  });
}

/** Mapa "<variant_id>|<series_number>" → series_id. */
async function getSeriesByVariantAndNumber(variantIds: string[]): Promise<Map<string, string>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("variant_series_map")
    .select("program_variant_id, series_id, program_series!inner ( series_number )")
    .in("program_variant_id", variantIds);

  const map = new Map<string, string>();
  if (error) {
    console.error("[notice-queries] getSeriesByVariantAndNumber:", error.message);
    return map;
  }

  // keep: variant_series_map JOIN program_series!inner — join shape not inferred.
  type Row = {
    program_variant_id: string;
    series_id: string;
    program_series: { series_number: number } | null;
  };

  for (const row of (data ?? []) as unknown as Row[]) {
    if (row.program_series) {
      map.set(`${row.program_variant_id}|${row.program_series.series_number}`, row.series_id);
    }
  }
  return map;
}

// --- 3) Ledger de deduplicación ------------------------------------------

/** Claves ya enviadas para estas clientas, en el formato de `sentKey`. */
export async function getSentKeys(profileIds: string[]): Promise<Set<string>> {
  const keys = new Set<string>();
  if (profileIds.length === 0) return keys;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("automated_notices")
    .select("profile_id, rule, period_key")
    .in("profile_id", profileIds);

  if (error) {
    console.error("[notice-queries] getSentKeys:", error.message);
    // Devolver un set vacío haría creer que no se ha enviado nada y dispararía
    // un reenvío masivo. Se propaga el fallo para que la corrida aborte.
    throw new Error("No se pudo leer el ledger de avisos");
  }

  for (const row of (data ?? []) as { profile_id: string; rule: NoticeRule; period_key: string }[]) {
    keys.add(sentKey(row.profile_id, row.rule, row.period_key));
  }
  return keys;
}

/**
 * Reclama el envío insertando la fila del ledger ANTES de enviar. Devuelve true
 * sólo si la fila entró de verdad; si el unique la rechaza, otra corrida ya lo
 * mandó y no se envía nada.
 *
 * El orden importa: si se enviara primero y el proceso cayera antes de
 * registrar, la siguiente corrida reenviaría. Así una caída cuesta un mensaje
 * perdido, nunca uno duplicado.
 */
export async function claimNotice(
  profileId: string,
  rule: NoticeRule,
  periodKey: string
): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("automated_notices")
    .upsert(
      { profile_id: profileId, rule, period_key: periodKey },
      { onConflict: "profile_id,rule,period_key", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error("[notice-queries] claimNotice:", error.message);
    return false;
  }
  // ignoreDuplicates: sin filas devueltas significa que la clave ya existía.
  return (data ?? []).length > 0;
}

// --- 4) Plantillas --------------------------------------------------------

/** Copia editable de cada regla, incluido su interruptor `is_active`. */
export async function getNoticeTemplates(): Promise<NoticeTemplates | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("automated_messages")
    .select("rule, subject, body, is_active");

  if (error) {
    console.error("[notice-queries] getNoticeTemplates:", error.message);
    return null;
  }

  const rows = (data ?? []) as { rule: NoticeRule; subject: string; body: string; is_active: boolean }[];
  const templates = {} as NoticeTemplates;
  for (const r of rows) {
    templates[r.rule] = { subject: r.subject, body: r.body, is_active: r.is_active };
  }
  return templates;
}

/** Escribe el mensaje in-app (messages + message_recipients) para una clienta. */
export async function insertNoticeMessage(params: {
  senderId: string | null;
  profileId: string;
  subject: string;
  body: string;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const { data: msg, error: msgErr } = await supabase
    .from("messages")
    .insert({
      sender_id: params.senderId,
      subject: params.subject,
      body: params.body,
      is_broadcast: false,
    })
    .select("id")
    .single();

  if (msgErr || !msg) {
    console.error("[notice-queries] insertNoticeMessage:", msgErr?.message);
    return false;
  }

  const { error: recErr } = await supabase
    .from("message_recipients")
    .insert({ message_id: (msg as { id: string }).id, recipient_id: params.profileId });

  if (recErr) {
    console.error("[notice-queries] insertNoticeMessage.recipient:", recErr.message);
    return false;
  }
  return true;
}

/** Perfil admin que figura como remitente de los avisos automáticos. */
export async function getAdminSenderId(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
