"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  MessageCircle,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clientes", icon: Users },
  { href: "/admin/content", label: "Contenido", icon: BookOpen },
  { href: "/admin/messages", label: "Mensajes", icon: MessageCircle },
  { href: "/admin/onboarding-settings", label: "Onboarding", icon: Settings },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex" style={{ minHeight: "100dvh", background: "#f4f4f5" }}>
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col"
        style={{
          width: 220,
          background: "#fff",
          borderRight: "1px solid var(--gris-linea)",
          position: "sticky",
          top: 0,
          height: "100dvh",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-baseline gap-2 px-6"
          style={{ height: 60, borderBottom: "1px solid var(--gris-linea)" }}
        >
          <span
            className="font-head font-semibold uppercase"
            style={{ fontSize: 15, letterSpacing: "0.18em" }}
          >
            AURA
          </span>
          <span
            className="font-body rounded px-1.5 py-0.5"
            style={{
              fontSize: 10,
              fontWeight: 600,
              background: "var(--lavanda-tint)",
              color: "var(--lavanda-dark)",
              letterSpacing: "0.04em",
            }}
          >
            Admin
          </span>
        </div>

        {/* Nav */}
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

        {/* Footer */}
        <div
          className="px-3 py-4"
          style={{ borderTop: "1px solid var(--gris-linea)" }}
        >
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
