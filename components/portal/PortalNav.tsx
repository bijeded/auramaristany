"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, MessageCircle, Settings, Layers } from "lucide-react";

const BASE_ITEMS = [
  { href: "/portal/today", label: "Hoy", icon: CalendarDays },
  { href: "/portal/history", label: "Historial", icon: Clock },
  { href: "/portal/messages", label: "Mensajes", icon: MessageCircle },
  { href: "/portal/settings", label: "Configuración", icon: Settings },
] as const;

const PILARES_ITEM = { href: "/portal/pilares", label: "Pilares", icon: Layers } as const;

export function PortalNav({ showPilares }: { showPilares: boolean }) {
  const pathname = usePathname();

  const items = showPilares
    ? [BASE_ITEMS[0], PILARES_ITEM, ...BASE_ITEMS.slice(1)]
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
  );
}
