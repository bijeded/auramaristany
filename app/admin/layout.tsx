import { LogoutButton } from "@/components/auth/LogoutButton";
import { AdminSidebarNav } from "@/components/admin/AdminSidebarNav";
import { requireAdminPage } from "@/lib/admin/auth";

// Red de seguridad: los layouts no se re-renderizan en navegación suave,
// así que cada página admin conserva su propio requireAdminPage().
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();

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
          className="flex items-center gap-2 px-6"
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
        <AdminSidebarNav />

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
