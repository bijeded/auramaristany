import { describe, it, expect } from "vitest";
import {
  agendarCellKey,
  bookingPeriodKey,
  evaluateNotices,
  inactivityPeriodKey,
  isFirstDayOfAgendarRun,
  renderTemplate,
  sentKey,
  type NoticeCandidate,
  type NoticeTemplates,
} from "@/lib/admin/notice-rules";

// --- Fixtures -------------------------------------------------------------
// Periodo que arranca en MIÉRCOLES 2026-07-01. Para esta clienta:
//   día 1 = W1 miércoles · día 2 = W1 jueves · día 3 = W1 viernes
//   día 15 = W3 miércoles (14 días = exactamente 2 semanas)
const SERIES = "series-mes-1";
const PERIOD_START = "2026-07-01T00:00:00Z";

const base: NoticeCandidate = {
  profile_id: "p1",
  email: "ana@x.com",
  full_name: "Ana López",
  status: "active",
  cancel_at_period_end: false,
  current_period_start: PERIOD_START,
  enrollment_date: "2026-07-01",
  series_id: SERIES,
  last_activity_date: "2026-07-01",
  has_future_call: false,
};

const templates: NoticeTemplates = {
  booking_reminder: { subject: "Agenda tu llamada", body: "Hola {nombre}: ya puedes agendar.", is_active: true },
  inactivity_nudge: { subject: "¿Todo bien?", body: "Hola {nombre}: te extrañamos.", is_active: true },
};

// Ventana de 3 días colocada por Aura en W1 mié-jue-vie.
const cells = new Set([
  agendarCellKey(SERIES, 1, "miercoles"),
  agendarCellKey(SERIES, 1, "jueves"),
  agendarCellKey(SERIES, 1, "viernes"),
]);

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

// --- isFirstDayOfAgendarRun ----------------------------------------------
describe("isFirstDayOfAgendarRun", () => {
  it("es true el primer día de la ventana", () => {
    // Arrange — 2026-07-01 es el día 1 (W1 miércoles), primer día de la ventana.
    // Act
    const result = isFirstDayOfAgendarRun(base, cells, at("2026-07-01"));
    // Assert
    expect(result).toBe(true);
  });

  it("es false el segundo día de la misma ventana", () => {
    expect(isFirstDayOfAgendarRun(base, cells, at("2026-07-02"))).toBe(false);
  });

  it("es false el tercer día de la misma ventana", () => {
    expect(isFirstDayOfAgendarRun(base, cells, at("2026-07-03"))).toBe(false);
  });

  it("es false fuera de la ventana", () => {
    expect(isFirstDayOfAgendarRun(base, cells, at("2026-07-04"))).toBe(false);
  });

  it("cada clienta lo cumple en SU primer día, aunque compartan la misma celda", () => {
    // Arrange — Bea arranca en DOMINGO: la misma celda (W1 miércoles) le cae el día 4.
    const bea: NoticeCandidate = {
      ...base,
      profile_id: "p2",
      current_period_start: "2026-06-28T00:00:00Z", // domingo
    };

    // Act — 2026-07-01 (miércoles) es día 4 de Bea y día 1 de Ana.
    const beaFirst = isFirstDayOfAgendarRun(bea, cells, at("2026-07-01"));
    const anaFirst = isFirstDayOfAgendarRun(base, cells, at("2026-07-01"));

    // Assert — ambas reciben el aviso el primer día de SU ventana.
    expect(beaFirst).toBe(true);
    expect(anaFirst).toBe(true);
  });

  it("no dispara en la celda de otra serie", () => {
    // Arrange — la clienta va en el mes 2, la ventana está en la serie del mes 1.
    const otherSeries = { ...base, series_id: "series-mes-2" };
    // Act / Assert
    expect(isFirstDayOfAgendarRun(otherSeries, cells, at("2026-07-01"))).toBe(false);
  });

  it("es false si la clienta no tiene serie resuelta", () => {
    expect(isFirstDayOfAgendarRun({ ...base, series_id: null }, cells, at("2026-07-01"))).toBe(false);
  });

  it("detecta el inicio de una ventana que cruza el límite de semana", () => {
    // Arrange — ventana en W1 martes (día 7 de Ana) y W2 miércoles (día 8).
    const crossing = new Set([
      agendarCellKey(SERIES, 1, "martes"),
      agendarCellKey(SERIES, 2, "miercoles"),
    ]);

    // Act — 2026-07-07 es martes (día 7, W1); 2026-07-08 miércoles (día 8, W2).
    // Assert
    expect(isFirstDayOfAgendarRun(base, crossing, at("2026-07-07"))).toBe(true);
    expect(isFirstDayOfAgendarRun(base, crossing, at("2026-07-08"))).toBe(false);
  });

  it("NO vuelve a disparar cuando el día 29 recae en una celda de W4 ya visitada", () => {
    // Arrange — week_number va topado a 4, así que el día 29 vuelve a (W4, mismo dow)
    // que el día 22. Con la ventana en W4 miércoles, el día 22 es el primer día.
    const w4 = new Set([agendarCellKey(SERIES, 4, "miercoles")]);

    // Act — 2026-07-22 = día 22 (W4 miércoles); 2026-07-29 = día 29 (W4 miércoles otra vez).
    const day22 = isFirstDayOfAgendarRun(base, w4, at("2026-07-22"));
    const day29 = isFirstDayOfAgendarRun(base, w4, at("2026-07-29"));

    // Assert — el día 29 vuelve a parecer "primer día" (el día 28 es W4 martes, sin
    // bloque), así que la protección real es la period_key, no esta función.
    expect(day22).toBe(true);
    expect(day29).toBe(true);
    // …y ambas producen LA MISMA clave, por lo que el ledger absorbe la segunda.
    expect(bookingPeriodKey(base, at("2026-07-22"))).toBe(bookingPeriodKey(base, at("2026-07-29")));
  });
});

// --- period keys ----------------------------------------------------------
describe("bookingPeriodKey", () => {
  it("combina el inicio del periodo con la celda del día", () => {
    expect(bookingPeriodKey(base, at("2026-07-01"))).toBe("2026-07-01:W1-miercoles");
  });

  it("distingue dos ventanas del mismo periodo", () => {
    const w1 = bookingPeriodKey(base, at("2026-07-01")); // W1 miércoles
    const w3 = bookingPeriodKey(base, at("2026-07-15")); // W3 miércoles
    expect(w1).not.toBe(w3);
  });

  it("cambia cuando cambia el periodo de facturación", () => {
    const next = { ...base, current_period_start: "2026-08-01T00:00:00Z" };
    expect(bookingPeriodKey(next, at("2026-08-01"))).not.toBe(bookingPeriodKey(base, at("2026-07-01")));
  });
});

describe("inactivityPeriodKey", () => {
  it("se ancla a la última actividad (una racha, un aviso)", () => {
    expect(inactivityPeriodKey({ ...base, last_activity_date: "2026-07-05" })).toBe("2026-07-05");
  });

  it("usa un centinela con la fecha de alta si nunca hubo actividad", () => {
    expect(inactivityPeriodKey({ ...base, last_activity_date: null })).toBe("never:2026-07-01");
  });

  it("cambia si la clienta vuelve a registrar y luego recae", () => {
    const primera = inactivityPeriodKey({ ...base, last_activity_date: "2026-07-05" });
    const segunda = inactivityPeriodKey({ ...base, last_activity_date: "2026-07-20" });
    expect(primera).not.toBe(segunda);
  });
});

// --- renderTemplate -------------------------------------------------------
describe("renderTemplate", () => {
  it("sustituye {nombre} por el primer nombre", () => {
    expect(renderTemplate("Hola {nombre}:", "Ana López")).toBe("Hola Ana:");
  });

  it("deja literales los placeholders desconocidos", () => {
    // Un cron NUNCA debe romperse porque alguien escribió {nombre2}.
    expect(renderTemplate("Hola {nombre2}:", "Ana López")).toBe("Hola {nombre2}:");
  });

  it("sustituye todas las apariciones", () => {
    expect(renderTemplate("{nombre}, {nombre}", "Ana")).toBe("Ana, Ana");
  });

  it("no deja puntuación colgada cuando no hay nombre", () => {
    // Arrange / Act
    const out = renderTemplate("Hola {nombre}: ¿todo bien?", null);
    // Assert — "Hola : ¿todo bien?" se leería como un error de la plataforma.
    expect(out).toBe("Hola: ¿todo bien?");
  });

  it("no lanza con un cuerpo vacío", () => {
    expect(renderTemplate("", "Ana")).toBe("");
  });
});

// --- evaluateNotices ------------------------------------------------------
describe("evaluateNotices", () => {
  const noSent = new Set<string>();
  const today = at("2026-07-01");

  it("emite el recordatorio de agenda el primer día de la ventana", () => {
    // Act
    const out = evaluateNotices([base], cells, noSent, templates, today);
    // Assert
    expect(out).toHaveLength(1);
    expect(out[0].rule).toBe("booking_reminder");
    expect(out[0].period_key).toBe("2026-07-01:W1-miercoles");
    expect(out[0].body).toBe("Hola Ana: ya puedes agendar.");
    expect(out[0].email).toBe("ana@x.com");
  });

  it("no emite nada si la clave ya está en el ledger", () => {
    // Arrange
    const sent = new Set([sentKey("p1", "booking_reminder", "2026-07-01:W1-miercoles")]);
    // Act
    const out = evaluateNotices([base], cells, sent, templates, today);
    // Assert
    expect(out).toHaveLength(0);
  });

  it("no emite el recordatorio si ya tiene llamada futura", () => {
    const out = evaluateNotices([{ ...base, has_future_call: true }], cells, noSent, templates, today);
    expect(out.filter((i) => i.rule === "booking_reminder")).toHaveLength(0);
  });

  it("no emite el recordatorio a una suscripción past_due", () => {
    // Pedirle agendar mientras le falla el cobro es mal momento (Stripe ya le escribe).
    const out = evaluateNotices([{ ...base, status: "past_due" }], cells, noSent, templates, today);
    expect(out.filter((i) => i.rule === "booking_reminder")).toHaveLength(0);
  });

  it("no emite NADA a quien ya canceló (cancel_at_period_end)", () => {
    const cancelling = { ...base, cancel_at_period_end: true, last_activity_date: null };
    const out = evaluateNotices([cancelling], cells, noSent, templates, today);
    expect(out).toHaveLength(0);
  });

  it("emite el aviso de inactividad tras 10 días sin registrar", () => {
    // Arrange — última actividad 2026-06-21, hoy 2026-07-01 → 10 días.
    const quiet = { ...base, last_activity_date: "2026-06-21" };
    // Act
    const out = evaluateNotices([quiet], new Set(), noSent, templates, today);
    // Assert
    expect(out).toHaveLength(1);
    expect(out[0].rule).toBe("inactivity_nudge");
    expect(out[0].period_key).toBe("2026-06-21");
  });

  it("no emite el aviso de inactividad antes del umbral", () => {
    const recent = { ...base, last_activity_date: "2026-06-25" }; // 6 días
    const out = evaluateNotices([recent], new Set(), noSent, templates, today);
    expect(out).toHaveLength(0);
  });

  it("emite el aviso de inactividad a quien nunca registró", () => {
    const never = { ...base, last_activity_date: null };
    const out = evaluateNotices([never], new Set(), noSent, templates, today);
    expect(out).toHaveLength(1);
    expect(out[0].period_key).toBe("never:2026-07-01");
  });

  it("SÍ emite el aviso de inactividad a una suscripción past_due", () => {
    const quiet = { ...base, status: "past_due" as const, last_activity_date: "2026-06-01" };
    const out = evaluateNotices([quiet], new Set(), noSent, templates, today);
    expect(out.filter((i) => i.rule === "inactivity_nudge")).toHaveLength(1);
  });

  it("no emite nada si la plantilla está desactivada", () => {
    // Arrange — el kill switch de Aura.
    const off: NoticeTemplates = {
      ...templates,
      booking_reminder: { ...templates.booking_reminder, is_active: false },
    };
    // Act
    const out = evaluateNotices([base], cells, noSent, off, today);
    // Assert
    expect(out).toHaveLength(0);
  });

  it("desactivar una regla no afecta a la otra", () => {
    const off: NoticeTemplates = {
      ...templates,
      booking_reminder: { ...templates.booking_reminder, is_active: false },
    };
    const quiet = { ...base, last_activity_date: "2026-06-01" };
    const out = evaluateNotices([quiet], cells, noSent, off, today);
    expect(out).toHaveLength(1);
    expect(out[0].rule).toBe("inactivity_nudge");
  });

  it("una misma clienta puede recibir ambas reglas el mismo día", () => {
    // Arrange — primer día de ventana Y 10 días sin registrar.
    const both = { ...base, last_activity_date: "2026-06-01" };
    // Act
    const out = evaluateNotices([both], cells, noSent, templates, today);
    // Assert
    expect(out.map((i) => i.rule).sort()).toEqual(["booking_reminder", "inactivity_nudge"]);
  });

  it("no emite nada a una suscripción sin acceso (canceled)", () => {
    const gone = { ...base, status: "canceled" as const, last_activity_date: null };
    const out = evaluateNotices([gone], cells, noSent, templates, today);
    expect(out).toHaveLength(0);
  });

  it("procesa varias clientas de forma independiente", () => {
    const otra: NoticeCandidate = {
      ...base,
      profile_id: "p9",
      email: "bea@x.com",
      full_name: "Bea Ruiz",
      last_activity_date: "2026-06-01",
    };
    const out = evaluateNotices([base, otra], cells, noSent, templates, today);
    expect(out).toHaveLength(3); // Ana: booking · Bea: booking + inactividad
    expect(out.filter((i) => i.profile_id === "p9")).toHaveLength(2);
  });
});
