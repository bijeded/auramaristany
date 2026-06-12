// CTA del banner: sin Stripe Customer Portal todavía, la vía para resolver el
// pago es contactar a Aura por WhatsApp (mismo patrón que el resto del portal).
const auraWhatsapp = (process.env.NEXT_PUBLIC_AURA_WHATSAPP ?? "").replace(/[^0-9]/g, "");

export function PaymentPendingBanner() {
  const waHref = auraWhatsapp
    ? `https://wa.me/${auraWhatsapp}?text=${encodeURIComponent(
        "Hola, tengo un pago pendiente en mi suscripción y quiero resolverlo."
      )}`
    : null;

  return (
    <div
      role="status"
      className="px-4 py-3 text-sm text-center"
      style={{ background: "#fff4e5", color: "#8a5a00", borderBottom: "1px solid #ffe0b2" }}
    >
      Tu último pago está pendiente. Mantienes el acceso mientras se procesa; si el
      problema persiste, actualiza tu método de pago para no perder tu programa.
      {waHref ? (
        <>
          {" "}
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold whitespace-nowrap"
            style={{ color: "#8a5a00" }}
          >
            Resolver mi pago →
          </a>
        </>
      ) : null}
    </div>
  );
}
