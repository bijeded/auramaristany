import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
const batchMock = vi.fn();
let resendStub: { emails: { send: typeof sendMock }; batch: { send: typeof batchMock } } | null;

vi.mock("@/lib/email/client", () => ({
  getResend: () => resendStub,
  fromAddress: () => "onboarding@resend.dev",
  appUrl: () => "https://app.test",
}));

import { sendWelcomeEmail, sendNewMessageEmailBatch } from "@/lib/email/send";

beforeEach(() => {
  sendMock.mockReset();
  batchMock.mockReset();
  resendStub = { emails: { send: sendMock }, batch: { send: batchMock } };
});

// safeSend es el envoltorio común de todos los envíos individuales; se ejercita
// a través de sendWelcomeEmail, que sí tiene llamadores reales.
describe("safeSend (vía sendWelcomeEmail)", () => {
  it("devuelve ok:false sin lanzar cuando no hay cliente", async () => {
    resendStub = null;
    await expect(sendWelcomeEmail({ to: "a@x.com", name: "Ana" })).resolves.toEqual({
      ok: false,
      error: "email disabled",
    });
  });

  it("devuelve ok:false sin lanzar cuando el cliente arroja", async () => {
    sendMock.mockRejectedValueOnce(new Error("boom"));
    const res = await sendWelcomeEmail({ to: "a@x.com", name: "Ana" });
    expect(res.ok).toBe(false);
  });
});

describe("sendNewMessageEmailBatch", () => {
  const recipient = (i: number) => ({
    email: `c${i}@x.com`,
    subject: "Asunto",
    body: `Hola cliente ${i}`,
  });

  it("trocea en lotes de 100 y no lanza si el batch falla", async () => {
    batchMock.mockRejectedValue(new Error("rate"));
    const recipients = Array.from({ length: 150 }, (_, i) => recipient(i));
    await expect(sendNewMessageEmailBatch(recipients)).resolves.toBeUndefined();
    expect(batchMock).toHaveBeenCalledTimes(2);
    expect(batchMock.mock.calls[0][0]).toHaveLength(100);
    expect(batchMock.mock.calls[1][0]).toHaveLength(50);
  });

  it("no hace nada si no hay cliente", async () => {
    resendStub = null;
    await expect(sendNewMessageEmailBatch([recipient(0)])).resolves.toBeUndefined();
    expect(batchMock).not.toHaveBeenCalled();
  });

  it("no hace nada con una lista vacía", async () => {
    await expect(sendNewMessageEmailBatch([])).resolves.toBeUndefined();
    expect(batchMock).not.toHaveBeenCalled();
  });

  it("incluye el asunto y el cuerpo del mensaje en el HTML", async () => {
    // Arrange
    batchMock.mockResolvedValue({ data: null, error: null });

    // Act
    await sendNewMessageEmailBatch([
      { email: "a@x.com", subject: "Mi Asunto", body: "Nos vemos el martes" },
    ]);

    // Assert
    const html = batchMock.mock.calls[0][0][0].html;
    expect(html).toContain("Mi Asunto");
    expect(html).toContain("Nos vemos el martes");
  });

  it("preserva los saltos de línea del cuerpo (pre-line, como el portal)", async () => {
    // Arrange
    batchMock.mockResolvedValue({ data: null, error: null });

    // Act
    await sendNewMessageEmailBatch([
      { email: "a@x.com", subject: "Asunto", body: "Línea 1\n\nLínea 2" },
    ]);

    // Assert — sin pre-line el email colapsa los párrafos que Aura escribió.
    expect(batchMock.mock.calls[0][0][0].html).toMatch(/pre-line/);
  });

  it("escapa el HTML del cuerpo en lugar de interpretarlo", async () => {
    // Arrange
    batchMock.mockResolvedValue({ data: null, error: null });

    // Act
    await sendNewMessageEmailBatch([
      { email: "a@x.com", subject: "Asunto", body: "<script>alert(1)</script>" },
    ]);

    // Assert — el cuerpo es texto plano; nunca debe pasar por dangerouslySetInnerHTML.
    const html = batchMock.mock.calls[0][0][0].html;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renderiza un HTML propio por destinataria (permite personalizar el cuerpo)", async () => {
    // Arrange — el cuerpo de A4 lleva {nombre} ya sustituido, distinto por clienta.
    batchMock.mockResolvedValue({ data: null, error: null });

    // Act
    await sendNewMessageEmailBatch([
      { email: "ana@x.com", subject: "Asunto", body: "Hola Ana" },
      { email: "bea@x.com", subject: "Asunto", body: "Hola Bea" },
    ]);

    // Assert
    const chunk = batchMock.mock.calls[0][0];
    expect(chunk).toHaveLength(2);
    expect(chunk[0].to).toBe("ana@x.com");
    expect(chunk[0].html).toContain("Hola Ana");
    expect(chunk[0].html).not.toContain("Hola Bea");
    expect(chunk[1].to).toBe("bea@x.com");
    expect(chunk[1].html).toContain("Hola Bea");
  });
});

// ---------------------------------------------------------------------------
// A4 — invariante de escape del cuerpo
// ---------------------------------------------------------------------------

describe("cuerpo del email: escape", () => {
  it("escapa el HTML del cuerpo en vez de interpretarlo", async () => {
    // `sanitizePlainTextBody` decodifica entidades al guardar, así que el cuerpo
    // almacenado PUEDE tener forma de HTML. El único motivo por el que eso es
    // seguro es que este sink escapa. Si alguien cambia la plantilla a
    // `dangerouslySetInnerHTML`, esta prueba lo detiene.
    await sendNewMessageEmailBatch([
      {
        email: "c@x.com",
        subject: "asunto",
        body: '<img src=x onerror=alert(1)>Fuerza & salud',
      },
    ]);

    const html: string = batchMock.mock.calls[0][0][0].html;
    // El payload llega entero, pero escapado: es texto inerte, no un tag.
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("Fuerza &amp; salud");
  });

  it("preserva los saltos de línea con white-space: pre-line", async () => {
    await sendNewMessageEmailBatch([
      { email: "c@x.com", subject: "asunto", body: "uno\n\ndos" },
    ]);

    const html: string = batchMock.mock.calls[0][0][0].html;
    expect(html).toMatch(/white-space:\s*pre-line/);
  });
});
