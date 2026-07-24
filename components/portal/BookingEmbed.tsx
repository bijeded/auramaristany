"use client";
import { useState } from "react";
import Script from "next/script";

/**
 * Embed inline de Calendly. Carga widget.js de Calendly y monta el widget
 * sobre el `data-url` (con el email del cliente pre-llenado). Muestra un
 * esqueleto hasta que el script está listo (sin spinner, según diseño).
 */
export function BookingEmbed({ calendlyUrl, email }: { calendlyUrl: string; email: string }) {
  const [ready, setReady] = useState(false);

  const url = new URL(calendlyUrl);
  url.searchParams.set("email", email);
  url.searchParams.set("hide_gdpr_banner", "1");

  return (
    <div className="relative" style={{ minHeight: 700 }}>
      {!ready && (
        <div
          className="absolute inset-0 rounded-xl animate-pulse"
          style={{ background: "var(--lavanda-tint)" }}
          aria-hidden
        />
      )}
      <div
        className="calendly-inline-widget"
        data-url={url.toString()}
        style={{ minWidth: 320, height: 700 }}
      />
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
    </div>
  );
}
