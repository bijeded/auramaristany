import "server-only";
import * as React from "react";
import { render } from "@react-email/render";
import { getResend, fromAddress, appUrl } from "./client";
import { NewMessageEmail } from "./templates/NewMessageEmail";
import { WelcomeEmail } from "./templates/WelcomeEmail";
import { PaymentFailedEmail } from "./templates/PaymentFailedEmail";
import { SubscriptionEndedEmail } from "./templates/SubscriptionEndedEmail";

export interface SendResult {
  ok: boolean;
  error?: string;
}

async function safeSend(to: string, subject: string, element: React.ReactElement): Promise<SendResult> {
  try {
    const resend = getResend();
    if (!resend) return { ok: false, error: "email disabled" };
    const html = await render(element);
    const { error } = await resend.emails.send({ from: fromAddress(), to, subject, html });
    if (error) return { ok: false, error: String(error) };
    return { ok: true };
  } catch (e) {
    console.error("[email] send failed", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const portalMessagesUrl = () => `${appUrl()}/portal/messages`;
const portalSettingsUrl = () => `${appUrl()}/portal/settings`;
const portalHomeUrl = () => `${appUrl()}/portal/today`;

export function sendNewMessageEmail({ to, subject, body }: { to: string; subject: string; body: string }): Promise<SendResult> {
  return safeSend(to, "Tienes un nuevo mensaje de Aura",
    React.createElement(NewMessageEmail, { subject, body, portalUrl: portalMessagesUrl() }));
}

export function sendWelcomeEmail({ to, name }: { to: string; name: string }): Promise<SendResult> {
  return safeSend(to, `¡Bienvenida a Aura, ${name}!`,
    React.createElement(WelcomeEmail, { name, portalUrl: portalHomeUrl() }));
}

export function sendPaymentFailedEmail({ to, name }: { to: string; name: string }): Promise<SendResult> {
  return safeSend(to, "Problema con tu pago — Aura",
    React.createElement(PaymentFailedEmail, { name, portalUrl: portalSettingsUrl() }));
}

export function sendSubscriptionEndedEmail({ to, name }: { to: string; name: string }): Promise<SendResult> {
  return safeSend(to, "Tu suscripción a Aura terminó",
    React.createElement(SubscriptionEndedEmail, { name, portalUrl: portalHomeUrl() }));
}

export interface MessageEmailRecipient {
  email: string;
  subject: string;
  /** Texto plano ya personalizado (A4 sustituye {nombre} antes de llegar aquí). */
  body: string;
}

/**
 * Broadcast best-effort: trocea en lotes de 100 (límite del batch endpoint de
 * Resend).
 *
 * El HTML se renderiza **por destinataria** en lugar de una sola vez: los
 * mensajes automáticos (A4) llevan el cuerpo personalizado, así que no hay un
 * HTML común que reutilizar. `resend.batch.send` acepta un `html` por objeto,
 * de modo que el troceado en 100 se conserva intacto.
 */
export async function sendNewMessageEmailBatch(recipients: MessageEmailRecipient[]): Promise<void> {
  const resend = getResend();
  if (!resend || recipients.length === 0) return;
  const emailSubject = "Tienes un nuevo mensaje de Aura";
  const portalUrl = portalMessagesUrl();
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = await Promise.all(
      recipients.slice(i, i + 100).map(async (r) => ({
        from: fromAddress(),
        to: r.email,
        subject: emailSubject,
        html: await render(React.createElement(NewMessageEmail, { subject: r.subject, body: r.body, portalUrl })),
      }))
    );
    try {
      await resend.batch.send(chunk);
    } catch (e) {
      console.error("[email] batch send failed", e);
    }
  }
}
