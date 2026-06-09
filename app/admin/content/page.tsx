import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { getAdminPrograms } from "@/lib/admin/queries";

const BILLING_LABELS: Record<string, string> = {
  fixed_term_monthly: "Plazo fijo mensual",
  ongoing_monthly: "Mensual recurrente",
};

export default async function AdminContentPage() {
  const programs = await getAdminPrograms();

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700 }}>
            Contenido
          </h1>
          <p className="font-body mt-1" style={{ fontSize: 14, color: "var(--gris-texto)" }}>
            Selecciona un programa para gestionar sus series y días.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {programs.map((program) => (
          <Link
            key={program.id}
            href={`/admin/content/${program.id}`}
            className="flex items-center justify-between rounded-xl p-5 bg-white"
            style={{
              border: "1.5px solid var(--gris-linea)",
              textDecoration: "none",
              boxShadow: "var(--shadow-card)",
              transition: "border-color 0.15s",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ width: 44, height: 44, background: "var(--lavanda-tint)" }}
              >
                <BookOpen size={20} color="var(--lavanda-dark)" strokeWidth={1.8} />
              </div>
              <div>
                <p className="font-head" style={{ fontSize: 16, fontWeight: 600, color: "var(--negro)" }}>
                  {program.name}
                </p>
                <p className="font-body mt-0.5" style={{ fontSize: 12, color: "var(--gris-texto)" }}>
                  {BILLING_LABELS[program.billing_model] ?? program.billing_model}
                  {program.duration_months ? ` · ${program.duration_months} meses` : ""}
                  {" · "}
                  <span style={{ fontWeight: 600 }}>{program.series_count}</span>{" "}
                  {program.series_count === 1 ? "serie" : "series"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!program.is_active && (
                <span
                  className="font-body rounded-full px-2.5 py-1"
                  style={{ fontSize: 11, fontWeight: 600, background: "#f0f0f0", color: "var(--gris-texto)" }}
                >
                  inactivo
                </span>
              )}
              <ChevronRight size={18} color="var(--gris-suave)" />
            </div>
          </Link>
        ))}

        {programs.length === 0 && (
          <div
            className="rounded-xl p-10 text-center"
            style={{ border: "1.5px dashed var(--gris-linea)", background: "#fff" }}
          >
            <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>
              No hay programas registrados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
