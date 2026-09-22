import { describe, it, expect } from "vitest";
import { paymentStatusBadge } from "@/lib/admin/payment-status";
import { BADGE_TONE } from "@/lib/ui/badge-tones";

// D8 — cuatro pantallas pintan el status de un pago y cada una caía a otra cosa
// ante un status sin entrada: dos a "Pendiente" (que afirma algo falso sobre la
// factura), una a "Anulado" y otra al valor crudo. Ahora hay una sola búsqueda.
describe("paymentStatusBadge", () => {
  it("los cuatro status de Stripe conservan su etiqueta", () => {
    expect(paymentStatusBadge("paid").text).toBe("Pagado");
    expect(paymentStatusBadge("open").text).toBe("Pendiente");
    expect(paymentStatusBadge("void").text).toBe("Anulado");
    expect(paymentStatusBadge("uncollectible").text).toBe("Fallido");
  });

  it("cada status usa su tono compartido", () => {
    expect(paymentStatusBadge("paid")).toMatchObject(BADGE_TONE.success);
    expect(paymentStatusBadge("open")).toMatchObject(BADGE_TONE.warning);
    expect(paymentStatusBadge("void")).toMatchObject(BADGE_TONE.neutral);
    expect(paymentStatusBadge("uncollectible")).toMatchObject(BADGE_TONE.danger);
  });

  it("un status sin entrada se muestra tal cual, en neutro, sin tomar otra etiqueta", () => {
    expect(paymentStatusBadge("draft")).toEqual({ text: "draft", ...BADGE_TONE.neutral });
  });
});
