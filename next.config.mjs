/** @type {import('next').NextConfig} */

// D11 — Content-Security-Policy. Baseline hardening so a compromised/injected
// script can't load arbitrary external origins into the authenticated portal.
// script-src/style-src keep 'unsafe-inline' because the App Router injects
// inline hydration scripts and the UI uses inline style={{}} throughout; a full
// nonce-based CSP is deferred launch work. External hosts are whitelisted:
//   Calendly (booking embed) · Google Fonts · YouTube (video block) ·
//   Supabase (storage images + realtime) · Stripe (checkout).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://assets.calendly.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://assets.calendly.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://img.youtube.com https://*.supabase.co https://*.calendly.com",
  "frame-src https://calendly.com https://*.calendly.com https://www.youtube.com https://js.stripe.com https://hooks.stripe.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.calendly.com https://api.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
