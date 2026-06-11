export function PaymentPendingBanner() {
  return (
    <div
      role="status"
      className="px-4 py-3 text-sm text-center"
      style={{ background: "#fff4e5", color: "#8a5a00", borderBottom: "1px solid #ffe0b2" }}
    >
      Tu último pago está pendiente. Mantienes el acceso mientras se procesa; si el
      problema persiste, actualiza tu método de pago para no perder tu programa.
    </div>
  );
}
