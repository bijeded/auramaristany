import { NextRequest, NextResponse } from "next/server";
import {
  verifyCalendlySignature,
  parseCalendlyEvent,
} from "@/lib/webhooks/calendly-verify";
import {
  getProfileIdByEmail,
  upsertBookingFromWebhook,
  markBookingCanceled,
} from "@/lib/content/booking-queries";

// Webhook de Calendly (invitee.created / invitee.canceled) → mantiene el
// ledger `bookings`. Máquina-a-máquina: el matcher de middleware ya excluye
// /api/webhooks (MW-3), así que no paga getUser().
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("calendly-webhook-signature");
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

  if (!signingKey) {
    console.error("[calendly] CALENDLY_WEBHOOK_SIGNING_KEY not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  if (!verifyCalendlySignature(signature, body, signingKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const event = parseCalendlyEvent(body);
    // Evento no soportado o payload incompleto → ack sin escribir.
    if (!event) {
      return NextResponse.json({ received: true });
    }

    // Cancelación: update-only por invitee_uri, terminal, sin mapear email.
    if (event.eventType === "invitee.canceled") {
      await markBookingCanceled(event.inviteeUri);
      return NextResponse.json({ received: true });
    }

    // Alta (invitee.created): mapear email → perfil y registrar la reserva.
    const profileId = await getProfileIdByEmail(event.email);
    // El email del invitee no mapea a ningún perfil → ack sin escribir
    // (brecha de mapeo aceptada; ver design.md).
    if (!profileId) {
      return NextResponse.json({ received: true });
    }

    await upsertBookingFromWebhook({
      profileId,
      calendlyInviteeUri: event.inviteeUri,
      calendlyEventUri: event.eventUri,
      scheduledAt: event.scheduledAt,
    });
  } catch (err) {
    // Sólo el mensaje/código — el objeto de error podría incluir el email (PII).
    console.error("[calendly] Handler error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
