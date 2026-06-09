"use client";

export function PortalHeader({ dateLabel }: { dateLabel: string }) {
  return (
    <div
      className="sticky top-0 z-10 flex items-center justify-between px-4"
      style={{
        height: 52,
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--gris-linea)",
      }}
    >
      <span
        className="font-head font-semibold tracking-widest uppercase"
        style={{ fontSize: 16, letterSpacing: "0.18em" }}
      >
        AURA
      </span>
      <span
        className="font-body"
        style={{ fontSize: 13, color: "var(--gris-texto)" }}
      >
        {dateLabel}
      </span>
    </div>
  );
}
