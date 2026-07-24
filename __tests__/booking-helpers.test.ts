import { describe, it, expect } from "vitest";
import {
  hasFutureCall,
  nextScheduledDate,
  dayHasAgendarBlock,
  escapeLikePattern,
} from "@/lib/content/booking-helpers";

const NOW = new Date("2026-07-24T12:00:00Z");

describe("hasFutureCall", () => {
  it("es true si hay una llamada activa en el futuro", () => {
    const bookings = [{ scheduled_at: "2026-07-30T18:00:00Z", status: "active" as const }];
    expect(hasFutureCall(bookings, NOW)).toBe(true);
  });

  it("es false si la única llamada futura está cancelada", () => {
    const bookings = [{ scheduled_at: "2026-07-30T18:00:00Z", status: "canceled" as const }];
    expect(hasFutureCall(bookings, NOW)).toBe(false);
  });

  it("es false si la llamada activa ya pasó", () => {
    const bookings = [{ scheduled_at: "2026-07-20T18:00:00Z", status: "active" as const }];
    expect(hasFutureCall(bookings, NOW)).toBe(false);
  });

  it("es false sin reservas", () => {
    expect(hasFutureCall([], NOW)).toBe(false);
  });

  it("una reserva exactamente en 'now' no cuenta como futura", () => {
    const bookings = [{ scheduled_at: NOW.toISOString(), status: "active" as const }];
    expect(hasFutureCall(bookings, NOW)).toBe(false);
  });

  it("es true si al menos una entre varias es activa y futura", () => {
    const bookings = [
      { scheduled_at: "2026-07-20T18:00:00Z", status: "active" as const },
      { scheduled_at: "2026-07-30T18:00:00Z", status: "canceled" as const },
      { scheduled_at: "2026-08-05T18:00:00Z", status: "active" as const },
    ];
    expect(hasFutureCall(bookings, NOW)).toBe(true);
  });
});

describe("nextScheduledDate", () => {
  it("devuelve la fecha de la próxima llamada activa futura", () => {
    const bookings = [
      { scheduled_at: "2026-08-05T18:00:00Z", status: "active" as const },
      { scheduled_at: "2026-07-30T18:00:00Z", status: "active" as const },
    ];
    expect(nextScheduledDate(bookings, NOW)).toBe("2026-07-30T18:00:00Z");
  });

  it("ignora canceladas y pasadas al elegir la próxima", () => {
    const bookings = [
      { scheduled_at: "2026-07-26T18:00:00Z", status: "canceled" as const },
      { scheduled_at: "2026-07-20T18:00:00Z", status: "active" as const },
      { scheduled_at: "2026-08-01T18:00:00Z", status: "active" as const },
    ];
    expect(nextScheduledDate(bookings, NOW)).toBe("2026-08-01T18:00:00Z");
  });

  it("devuelve null si no hay llamada activa futura", () => {
    const bookings = [{ scheduled_at: "2026-07-20T18:00:00Z", status: "active" as const }];
    expect(nextScheduledDate(bookings, NOW)).toBeNull();
  });

  it("devuelve null sin reservas", () => {
    expect(nextScheduledDate([], NOW)).toBeNull();
  });
});

describe("escapeLikePattern", () => {
  it("escapa guion bajo (comodín LIKE y carácter válido de email)", () => {
    expect(escapeLikePattern("john_doe@example.com")).toBe("john\\_doe@example.com");
  });

  it("escapa el signo de porcentaje", () => {
    expect(escapeLikePattern("a%b@example.com")).toBe("a\\%b@example.com");
  });

  it("escapa el backslash primero para no doble-escapar", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("deja intacto un email sin metacaracteres", () => {
    expect(escapeLikePattern("john.doe@example.com")).toBe("john.doe@example.com");
  });
});

describe("dayHasAgendarBlock", () => {
  it("es true si algún bloque es de tipo agendar", () => {
    const blocks = [{ block_type: "text" }, { block_type: "agendar" }];
    expect(dayHasAgendarBlock(blocks)).toBe(true);
  });

  it("es false si ningún bloque es agendar", () => {
    const blocks = [{ block_type: "text" }, { block_type: "youtube" }];
    expect(dayHasAgendarBlock(blocks)).toBe(false);
  });

  it("es false sin bloques", () => {
    expect(dayHasAgendarBlock([])).toBe(false);
  });
});
