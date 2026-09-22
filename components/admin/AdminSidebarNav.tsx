"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  MessageCircle,
  Bot,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clientes", icon: Users },
  { href: "/admin/content", label: "Contenido", icon: BookOpen },
  { href: "/admin/messages", label: "Mensajes", icon: MessageCircle },
  { href: "/admin/automated-messages", label: "Automáticos", icon: Bot },
  { href: "/admin/onboarding-settings", label: "Onboarding", icon: Settings },
] as const;

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 p-3 flex-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-body transition-colors"
            style={{
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              color: active ? "var(--lavanda-dark)" : "var(--gris-texto)",
              background: active ? "var(--lavanda-tint)" : "transparent",
              textDecoration: "none",
            }}
          >
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
