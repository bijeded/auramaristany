import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * Verifica la firma de un webhook de Calendly.
 * Header: `Calendly-Webhook-Signature: t=<unix>,v1=<hmac_sha256_hex>`
 * signed_payload = `${t}.${rawBody}` firmado con HMAC-SHA256 y la signing key.
 * Comparación timing-safe + ventana de replay sobre `t`.
 */
export function verifyCalendlySignature(
  header: string | null | undefined,
  rawBody: string,
  signingKey: string,
  opts?: { toleranceSeconds?: number; now?: Date }
): boolean {
  if (!header || !signingKey) return false;

  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, ...v] = kv.trim().split("=");
      return [k, v.join("=")];
    })
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const timestamp = Number(t);
  if (!Number.isFinite(timestamp)) return false;

  const now = opts?.now ?? new Date();
  const tolerance = opts?.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const ageSeconds = Math.abs(Math.floor(now.getTime() / 1000) - timestamp);
  if (ageSeconds > tolerance) return false;

  const expected = createHmac("sha256", signingKey)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(v1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type CalendlyEventType = "invitee.created" | "invitee.canceled";

export interface CalendlyBooking {
  eventType: CalendlyEventType;
  inviteeUri: string;
  eventUri: string;
  email: string;
  scheduledAt: string;
}

const SUPPORTED: CalendlyEventType[] = ["invitee.created", "invitee.canceled"];

/**
 * Extrae los campos de reserva del payload de Calendly. Devuelve null para
 * eventos no soportados, JSON inválido o payloads incompletos. El estado
 * (alta/cancelación) se decide por `eventType` en el route, no por el payload.
 */
export function parseCalendlyEvent(rawBody: string): CalendlyBooking | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const root = parsed as { event?: unknown; payload?: Record<string, unknown> };
  const eventType = root.event as CalendlyEventType;
  if (!SUPPORTED.includes(eventType)) return null;

  const p = root.payload;
  if (!p) return null;
  const scheduledEvent = p.scheduled_event as
    | { uri?: unknown; start_time?: unknown }
    | undefined;

  const inviteeUri = p.uri;
  const email = p.email;
  const eventUri = scheduledEvent?.uri;
  const scheduledAt = scheduledEvent?.start_time;

  if (
    typeof inviteeUri !== "string" ||
    typeof email !== "string" ||
    typeof eventUri !== "string" ||
    typeof scheduledAt !== "string"
  ) {
    return null;
  }

  return { eventType, inviteeUri, eventUri, email, scheduledAt };
}
