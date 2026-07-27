import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
const batchMock = vi.fn();
let resendStub: { emails: { send: typeof sendMock }; batch: { send: typeof batchMock } } | null;

vi.mock("@/lib/email/client", () => ({
  getResend: () => resendStub,
  fromAddress: () => "onboarding@resend.dev",
  appUrl: () => "https://app.test",
}));

import { sendNewMessageEmail, sendNewMessageEmailBatch } from "@/lib/email/send";

beforeEach(() => {
  sendMock.mockReset();
  batchMock.mockReset();
  resendStub = { emails: { send: sendMock }, batch: { send: batchMock } };
});

describe("sendNewMessageEmail", () => {
  it("devuelve ok:false sin lanzar cuando no hay cliente", async () => {
    resendStub = null;
    await expect(sendNewMessageEmail({ to: "a@x.com", subject: "Hola", body: "Cuerpo" })).resolves.toEqual({ ok: false, error: "email disabled" });
  });

  it("devuelve ok:false sin lanzar cuando el cliente arroja", async () => {
    sendMock.mockRejectedValueOnce(new Error("boom"));
    const res = await sendNewMessageEmail({ to: "a@x.com", subject: "Hola", body: "Cuerpo" });
    expect(res.ok).toBe(false);
  });

  it("envía y devuelve ok:true con HTML que contiene el asunto", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "e1" }, error: null });
    const res = await sendNewMessageEmail({ to: "a@x.com", subject: "Mi Asunto", body: "Hola" });
    expect(res.ok).toBe(true);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.to).toBe("a@x.com");
    expect(payload.html).toContain("Mi Asunto");
  });

  it("incluye el cuerpo del mensaje en el HTML", async () => {
    // Arrange
    sendMock.mockResolvedValueOnce({ data: { id: "e1" }, error: null });

    // Act
    await sendNewMessageEmail({ to: "a@x.com", subject: "Asunto", body: "Nos vemos el martes" });

    // Assert
    expect(sendMock.mock.calls[0][0].html).toContain("Nos vemos el martes");
  });

  it("preserva los saltos de línea del cuerpo (pre-line, como el portal)", async () => {
    // Arrange
    sendMock.mockResolvedValueOnce({ data: { id: "e1" }, error: null });

    // Act
    await sendNewMessageEmail({ to: "a@x.com", subject: "Asunto", body: "Línea 1\n\nLínea 2" });

    // Assert — sin pre-line el email colapsa los párrafos que Aura escribió.
    expect(sendMock.mock.calls[0][0].html).toMatch(/pre-line/);
  });

  it("escapa el HTML del cuerpo en lugar de interpretarlo", async () => {
    // Arrange
    sendMock.mockResolvedValueOnce({ data: { id: "e1" }, error: null });

    // Act
    await sendNewMessageEmail({
      to: "a@x.com",
      subject: "Asunto",
      body: "<script>alert(1)</script>",
    });

    // Assert — el cuerpo es texto plano; nunca debe pasar por dangerouslySetInnerHTML.
    const html = sendMock.mock.calls[0][0].html;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
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
