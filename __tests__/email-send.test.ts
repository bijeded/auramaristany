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
    await expect(sendNewMessageEmail({ to: "a@x.com", subject: "Hola" })).resolves.toEqual({ ok: false, error: "email disabled" });
  });

  it("devuelve ok:false sin lanzar cuando el cliente arroja", async () => {
    sendMock.mockRejectedValueOnce(new Error("boom"));
    const res = await sendNewMessageEmail({ to: "a@x.com", subject: "Hola" });
    expect(res.ok).toBe(false);
  });

  it("envía y devuelve ok:true con HTML que contiene el asunto", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "e1" }, error: null });
    const res = await sendNewMessageEmail({ to: "a@x.com", subject: "Mi Asunto" });
    expect(res.ok).toBe(true);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.to).toBe("a@x.com");
    expect(payload.html).toContain("Mi Asunto");
  });
});

describe("sendNewMessageEmailBatch", () => {
  it("trocea en lotes de 100 y no lanza si el batch falla", async () => {
    batchMock.mockRejectedValue(new Error("rate"));
    const recipients = Array.from({ length: 150 }, (_, i) => `c${i}@x.com`);
    await expect(sendNewMessageEmailBatch(recipients, "Asunto")).resolves.toBeUndefined();
    expect(batchMock).toHaveBeenCalledTimes(2);
  });

  it("no hace nada si no hay cliente", async () => {
    resendStub = null;
    await expect(sendNewMessageEmailBatch(["a@x.com"], "Asunto")).resolves.toBeUndefined();
    expect(batchMock).not.toHaveBeenCalled();
  });
});
