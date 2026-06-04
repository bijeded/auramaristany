import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura Maristany — Portal",
  description: "Tu programa de bienestar integral",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
