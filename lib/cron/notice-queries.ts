import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { ACCESS_STATES } from "@/lib/content/subscription-access";
import { resolveContentPosition } from "@/lib/content/ladder";
import { hasFutureCall, type BookingLike } from "@/lib/content/booking-helpers";
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
 *
 * ⚠ SÓLO PARA EL CRON. Estas funciones escriben con service-role y NO verifican
 * quién llama: `insertNoticeMessage` escribe un mensaje a cualquier profile_id
 * que reciba. El único guardián es el Bearer CRON_SECRET de
 * app/api/cron/automated-messages. No importar desde server actions ni desde la
 * pantalla de admin (PR3): un profile_id venido de un formulario convertiría
 * esto en escritura arbitraria de mensajes. Por eso el módulo vive en
 * `lib/cron/` y no en `lib/admin/`, donde la regla del proyecto es que
 * service-role va detrás de requireAdmin().
 */

/** Fallo de lectura que debe abortar la corrida en vez de fingir "nada que enviar". */
export class NoticeQueryError extends Error {}

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
    // Se propaga en lugar de devolver vacío: un Set vacío se confundiría con
    // "hoy no hay ninguna ventana abierta" y la corrida se reportaría sana.
    console.error("[notice-queries] getAgendarCells:", error.message);
    throw new NoticeQueryError("No se pudieron leer las ventanas de agenda");
  }

  // keep: program_day_blocks JOIN program_days!inner — join shape not inferred by the SDK.
  type Row = {
    program_days: { series_id: string; week_number: number; day_of_week: string } | null;
  };

  const cells = new Set<string>();
  for (const row of (data ?? []) as unknown as Row[]) {
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
 * `series_id` se resuelve aquí (puntero de contenido → variant_series_map)
 * para que la capa de reglas siga siendo pura: allí sólo se consultan Sets.
 */
export async function getNoticeCandidates(now: Date): Promise<NoticeCandidate[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `profile_id, status, cancel_at_period_end, completed_at, current_period_start, enrollment_date,
       content_variant_id, content_ordinal, program_variant_id,
       profiles!inner ( email, full_name, progress_logs ( log_date ), bookings ( scheduled_at, status ) )`
    )
    .in("status", ACCESS_STATES)
    // Sólo hace falta saber si hay llamada FUTURA; el histórico de reservas no
    // aporta nada y crece sin tope.
    .gt("profiles.bookings.scheduled_at", now.toISOString());

  if (error) {
    console.error("[notice-queries] getNoticeCandidates:", error.message);
    throw new NoticeQueryError("No se pudo leer el padrón de clientes");
  }

  // keep: subscriptions JOIN profiles!inner (+ progress_logs, bookings) — nested join
  // shape not inferred by the SDK without Relationships in the Database type.
  type Row = {
    profile_id: string;
    status: string;
    cancel_at_period_end: boolean | null;
    completed_at: string | null;
    current_period_start: string | null;
    enrollment_date: string;
    content_variant_id: string | null;
    content_ordinal: number;
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

  // Las variantes a consultar son los PELDAÑOS en los que están las clientes,
  // no los que compraron: en cuanto una sube de nivel dejan de coincidir.
  //
  // Se resuelve POR FILA, no en un mapa por `profile_id`: la consulta no es
  // `.single()`, así que un perfil con dos suscripciones en estado de acceso
  // devuelve dos filas y un mapa las colapsaría en una — ambas resolverían
  // contra el peldaño de la que sobreviviera.
  const variantIds = new Set<string>();
  for (const r of rows) {
    const p = resolveContentPosition(r);
    if (p) variantIds.add(p.variantId);
  }
  const seriesByVariant = await getSeriesByVariantAndNumber(
    Array.from(variantIds)
  );

  return rows.map((r) => {
    const logs = r.profiles!.progress_logs ?? [];
    const lastActivity = logs.reduce<string | null>(
      (max, l) => (max === null || l.log_date > max ? l.log_date : max),
      null
    );

    // Regla "una llamada futura no cancelada a la vez": la dueña es
    // booking-helpers (A6). No se reimplementa aquí para que no puedan divergir.
    const bookings = (r.profiles!.bookings ?? []) as BookingLike[];

    const position = resolveContentPosition(r);
    const seriesId = position
      ? seriesByVariant.get(`${position.variantId}|${position.ordinal}`) ?? null
      : null;

    return {
      profile_id: r.profile_id,
      email: r.profiles!.email,
      full_name: r.profiles!.full_name,
      status: r.status as NoticeCandidate["status"],
      cancel_at_period_end: r.cancel_at_period_end === true,
    completed_at: r.completed_at,
      current_period_start: r.current_period_start!,
      enrollment_date: r.enrollment_date,
      series_id: seriesId,
      last_activity_date: lastActivity,
      has_future_call: hasFutureCall(bookings, now),
    } satisfies NoticeCandidate;
  });
}

/**
 * Mapa "<variant_id>|<ordinal>" → series_id, sólo de series PUBLICADAS.
 *
 * El filtro es explícito porque aquí no hay red: este módulo usa service-role,
 * que se salta RLS, así que la policy `program_series_read_published` no aplica.
 * Sin él se avisaría de una ventana de agenda que vive en una serie en
 * borrador — la cliente recibe el correo, entra y no ve nada.
 */
async function getSeriesByVariantAndNumber(variantIds: string[]): Promise<Map<string, string>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("variant_series_map")
    .select("program_variant_id, series_id, ordinal, program_series!inner ( published )")
    .in("program_variant_id", variantIds)
    .eq("program_series.published", true);

  const map = new Map<string, string>();
  if (error) {
    // Un mapa vacío dejaría `series_id` nulo para TODAS las candidatas y
    // apagaría la regla de agenda entera, con la corrida reportando 200 OK.
    console.error("[notice-queries] getSeriesByVariantAndNumber:", error.message);
    throw new NoticeQueryError("No se pudieron resolver las series del mes");
  }

  type Row = {
    program_variant_id: string;
    series_id: string;
    ordinal: number;
  };

  // keep: variant_series_map JOIN program_series!inner — forma del join no inferida.
  for (const row of (data ?? []) as unknown as Row[]) {
    map.set(`${row.program_variant_id}|${row.ordinal}`, row.series_id);
  }
  return map;
}

// --- 3) Ledger de deduplicación ------------------------------------------

/**
 * Claves ya enviadas para estas clientas, en el formato de `sentKey`.
 *
 * Acotado por `period_key`: el ledger crece ~2 filas por clienta y mes para
 * siempre, y PostgREST corta en 1000 filas. Sin el filtro, pasado ese punto el
 * conjunto volvería parcial en silencio. Se piden sólo las claves que hoy están
 * en evaluación, así que el tamaño depende del padrón, no del histórico.
 * (Aunque llegara incompleto, `claimNotice` sigue impidiendo el duplicado: este
 * pre-filtro sólo evita viajes de ida y vuelta inútiles.)
 */
/** `.in()` viaja en la URL del GET: se trocea para no rebasar su límite. */
const IN_CHUNK = 100;

export async function getSentKeys(
  profileIds: string[],
  periodKeys: string[]
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (profileIds.length === 0 || periodKeys.length === 0) return keys;

  const supabase = createServiceClient();

  for (let i = 0; i < profileIds.length; i += IN_CHUNK) {
    const chunk = profileIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("automated_notices")
      .select("profile_id, rule, period_key")
      .in("profile_id", chunk)
      .in("period_key", periodKeys);

    if (error) {
      console.error("[notice-queries] getSentKeys:", error.message);
      // Devolver un set vacío haría creer que no se ha enviado nada y dispararía
      // un reenvío masivo. Se propaga el fallo para que la corrida aborte.
      throw new NoticeQueryError("No se pudo leer el ledger de avisos");
    }

    for (const row of (data ?? []) as { profile_id: string; rule: NoticeRule; period_key: string }[]) {
      keys.add(sentKey(row.profile_id, row.rule, row.period_key));
    }
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
export type ClaimResult = "claimed" | "already_sent" | "error";

export async function claimNotice(
  profileId: string,
  rule: NoticeRule,
  periodKey: string
): Promise<ClaimResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("automated_notices")
    .upsert(
      { profile_id: profileId, rule, period_key: periodKey },
      { onConflict: "profile_id,rule,period_key", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    // Se distingue de "ya estaba enviado": un fallo de escritura contado como
    // dedupe le reportaría a Aura un envío fallido como si fuera correcto.
    console.error("[notice-queries] claimNotice:", error.message);
    return "error";
  }
  // ignoreDuplicates: sin filas devueltas significa que la clave ya existía.
  return (data ?? []).length > 0 ? "claimed" : "already_sent";
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

/**
 * Libera una clave reclamada cuando el mensaje in-app no se pudo escribir.
 *
 * Sin esto, un fallo puntual del insert quemaba la clave para siempre: la
 * reclamación ya estaba puesta y nada reintenta una clave reclamada, así que la
 * clienta no recibía ese aviso nunca. Reclamar-antes-de-enviar sigue evitando el
 * duplicado; esto sólo recupera el caso recuperable.
 */
export async function releaseNotice(
  profileId: string,
  rule: NoticeRule,
  periodKey: string
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("automated_notices")
    .delete()
    .eq("profile_id", profileId)
    .eq("rule", rule)
    .eq("period_key", periodKey);
  if (error) console.error("[notice-queries] releaseNotice:", error.message);
}

/** Perfil admin que figura como remitente de los avisos automáticos. */
export async function getAdminSenderId(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Sin esto, un fallo de lectura era indistinguible de "no hay admin" y
    // todos los avisos quedaban sin remitente, en silencio.
    console.error("[notice-queries] getAdminSenderId:", error.message);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}
