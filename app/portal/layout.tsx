"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, MessageCircle, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/portal/today", label: "Hoy", icon: CalendarDays },
  { href: "/portal/history", label: "Historial", icon: Clock },
  { href: "/portal/messages", label: "Mensajes", icon: MessageCircle },
  { href: "/portal/settings", label: "Configuración", icon: Settings },
] as const;

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div style={{ background: "#e8e0e0", minHeight: "100dvh" }}>
      <div
        className="flex flex-col mx-auto"
        style={{ height: "100dvh", maxWidth: 640, background: "var(--rosa-soft)", boxShadow: "0 0 40px rgba(0,0,0,0.12)" }}
      >
      <main className="flex-1 overflow-y-auto">{children}</main>

      <nav
        className="flex-shrink-0 flex items-center justify-around border-t bg-white"
        style={{
          borderColor: "var(--gris-linea)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-3 px-4 min-w-0 flex-1"
              style={{
                color: active ? "var(--lavanda)" : "var(--gris-suave)",
                textDecoration: "none",
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span
                className="font-body"
                style={{
                  fontSize: 10.5,
                  fontWeight: active ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
      </div>
    </div>
  );
}
