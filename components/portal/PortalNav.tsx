"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, MessageCircle, Sun, User, Layers } from "lucide-react";

const BASE_ITEMS = [
  { href: "/portal/today", label: "Hoy", icon: Sun },
  { href: "/portal/semana", label: "Semana", icon: CalendarDays },
  { href: "/portal/history", label: "Historial", icon: Clock },
  { href: "/portal/messages", label: "Mensajes", icon: MessageCircle },
  { href: "/portal/settings", label: "Perfil", icon: User },
] as const;

const PILARES_ITEM = { href: "/portal/pilares", label: "Pilares", icon: Layers } as const;

export function PortalNav({ showPilares, unreadMessages = 0 }: { showPilares: boolean; unreadMessages?: number }) {
  const pathname = usePathname();

  const items = showPilares
    ? [BASE_ITEMS[0], BASE_ITEMS[1], PILARES_ITEM, ...BASE_ITEMS.slice(2)]
    : [...BASE_ITEMS];

  return (
    <nav
      className="flex-shrink-0 flex items-center justify-around border-t bg-white"
      style={{
        borderColor: "var(--gris-linea)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 py-3 px-1 min-w-0 flex-1"
            style={{
              color: active ? "var(--lavanda)" : "var(--gris-suave)",
              textDecoration: "none",
            }}
          >
            <div style={{ position: "relative" }}>
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              {href === "/portal/messages" && unreadMessages > 0 && (
                <span style={{ position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, padding: "0 4px",
                  borderRadius: 999, background: "var(--lavanda)", color: "#fff", fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </div>
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
  );
}
