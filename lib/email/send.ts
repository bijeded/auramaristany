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

export function sendNewMessageEmail({ to, subject }: { to: string; subject: string }): Promise<SendResult> {
  return safeSend(to, "Tienes un nuevo mensaje de Aura",
    React.createElement(NewMessageEmail, { subject, portalUrl: portalMessagesUrl() }));
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

/** Broadcast best-effort: trocea en lotes de 100 (límite del batch endpoint de Resend). */
export async function sendNewMessageEmailBatch(recipients: string[], subject: string): Promise<void> {
  const resend = getResend();
  if (!resend || recipients.length === 0) return;
  const html = await render(React.createElement(NewMessageEmail, { subject, portalUrl: portalMessagesUrl() }));
  const emailSubject = "Tienes un nuevo mensaje de Aura";
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100).map((to) => ({ from: fromAddress(), to, subject: emailSubject, html }));
    try {
      await resend.batch.send(chunk);
    } catch (e) {
      console.error("[email] batch send failed", e);
    }
  }
}
