import "server-only";
import { Resend } from "resend";

let cached: Resend | null = null;

/** Devuelve el cliente Resend, o null si no hay API key (no-op en dev/test). */
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY no configurada — email deshabilitado (no-op).");
    return null;
  }
  if (!cached) cached = new Resend(key);
  return cached;
}

/** Remitente: en dev sin dominio verificado usar onboarding@resend.dev. */
export function fromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from && process.env.RESEND_API_KEY) {
    console.warn(
      "[email] RESEND_FROM_EMAIL no configurada con una API key presente — usando onboarding@resend.dev (solo entrega a la dirección dueña de la cuenta Resend)."
    );
  }
  return from ?? "onboarding@resend.dev";
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.auramaristany.com";
}
