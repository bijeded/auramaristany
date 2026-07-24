import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyCalendlySignature,
  parseCalendlyEvent,
} from "@/lib/webhooks/calendly-verify";

const KEY = "test-signing-key";
const NOW = new Date("2026-07-24T12:00:00Z");

function sign(body: string, timestamp: number, key = KEY): string {
  const v1 = createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

describe("verifyCalendlySignature", () => {
  const body = '{"event":"invitee.created"}';
  const ts = Math.floor(NOW.getTime() / 1000);

  it("acepta una firma válida dentro de la ventana", () => {
    const header = sign(body, ts);
    expect(verifyCalendlySignature(header, body, KEY, { now: NOW })).toBe(true);
  });

  it("rechaza si el cuerpo fue alterado", () => {
    const header = sign(body, ts);
    expect(verifyCalendlySignature(header, body + "x", KEY, { now: NOW })).toBe(false);
  });

  it("rechaza con la llave equivocada", () => {
    const header = sign(body, ts, "otra-llave");
    expect(verifyCalendlySignature(header, body, KEY, { now: NOW })).toBe(false);
  });

  it("rechaza un header ausente o malformado", () => {
    expect(verifyCalendlySignature(null, body, KEY, { now: NOW })).toBe(false);
    expect(verifyCalendlySignature("garbage", body, KEY, { now: NOW })).toBe(false);
    expect(verifyCalendlySignature("t=123", body, KEY, { now: NOW })).toBe(false);
  });

  it("rechaza un timestamp fuera de la ventana de replay", () => {
    const oldTs = ts - 400; // 400s > tolerancia por defecto
    const header = sign(body, oldTs);
    expect(verifyCalendlySignature(header, body, KEY, { now: NOW })).toBe(false);
  });

  it("respeta una tolerancia explícita", () => {
    const oldTs = ts - 120;
    const header = sign(body, oldTs);
    expect(verifyCalendlySignature(header, body, KEY, { now: NOW, toleranceSeconds: 60 })).toBe(false);
    expect(verifyCalendlySignature(header, body, KEY, { now: NOW, toleranceSeconds: 300 })).toBe(true);
  });

  it("es false con signingKey vacío", () => {
    const header = sign(body, ts);
    expect(verifyCalendlySignature(header, body, "", { now: NOW })).toBe(false);
  });
});

describe("parseCalendlyEvent", () => {
  const createdBody = JSON.stringify({
    event: "invitee.created",
    payload: {
      email: "cliente@example.com",
      uri: "https://api.calendly.com/scheduled_events/EV1/invitees/IN1",
      status: "active",
      scheduled_event: {
        uri: "https://api.calendly.com/scheduled_events/EV1",
        start_time: "2026-08-01T18:00:00.000000Z",
      },
    },
  });

  it("extrae los campos de un invitee.created", () => {
    expect(parseCalendlyEvent(createdBody)).toEqual({
      eventType: "invitee.created",
      inviteeUri: "https://api.calendly.com/scheduled_events/EV1/invitees/IN1",
      eventUri: "https://api.calendly.com/scheduled_events/EV1",
      email: "cliente@example.com",
      scheduledAt: "2026-08-01T18:00:00.000000Z",
    });
  });

  it("reconoce un invitee.canceled (el estado lo decide el route por eventType)", () => {
    const canceledBody = JSON.stringify({
      event: "invitee.canceled",
      payload: {
        email: "cliente@example.com",
        uri: "https://api.calendly.com/scheduled_events/EV1/invitees/IN1",
        scheduled_event: {
          uri: "https://api.calendly.com/scheduled_events/EV1",
          start_time: "2026-08-01T18:00:00.000000Z",
        },
      },
    });
    const parsed = parseCalendlyEvent(canceledBody);
    expect(parsed?.eventType).toBe("invitee.canceled");
  });

  it("devuelve null para un tipo de evento no soportado", () => {
    const other = JSON.stringify({ event: "routing_form_submission.created", payload: {} });
    expect(parseCalendlyEvent(other)).toBeNull();
  });

  it("devuelve null para JSON inválido", () => {
    expect(parseCalendlyEvent("{not json")).toBeNull();
  });

  it("devuelve null si faltan campos obligatorios", () => {
    const missing = JSON.stringify({ event: "invitee.created", payload: { email: "a@b.com" } });
    expect(parseCalendlyEvent(missing)).toBeNull();
  });
});
