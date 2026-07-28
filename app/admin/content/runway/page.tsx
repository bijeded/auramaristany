import Link from "next/link";
import { AlertTriangle, RotateCw, ChevronLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getContentRunway } from "@/lib/admin/content-runway-queries";
import { RUNWAY_THRESHOLD } from "@/lib/admin/content-runway";

export default async function ContentRunwayPage() {
  await requireAdminPage();
  const rows = await getContentRunway();

  return (
    <div className="p-8 max-w-3xl">
      <Link
        href="/admin/content"
        className="font-body inline-flex items-center gap-1 mb-4"
        style={{ fontSize: 13, color: "var(--gris-texto)", textDecoration: "none" }}
      >
        <ChevronLeft size={15} /> Contenido
      </Link>

      <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700 }}>
        Se les acaba el contenido
      </h1>
      <p className="font-body mt-1 mb-8" style={{ fontSize: 14, color: "var(--gris-texto)" }}>
        Clientes a las que les quedan {RUNWAY_THRESHOLD} meses o menos de contenido
        nuevo en su nivel.
      </p>

      {rows.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ border: "1.5px dashed var(--gris-linea)", background: "#fff" }}
        >
          <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>
            A nadie se le está acabando el contenido. Todas tienen más de{" "}
            {RUNWAY_THRESHOLD} meses por delante en su nivel.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const urgent = row.kind === "next_rung_empty";
            const Icon = urgent ? AlertTriangle : RotateCw;
            return (
              <Link
                key={row.subscriptionId}
                href={`/admin/clients/${row.clientId}`}
                className="flex items-start gap-4 rounded-xl p-5 bg-white"
                style={{
                  border: `1.5px solid ${urgent ? "var(--error)" : "var(--gris-linea)"}`,
                  textDecoration: "none",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    width: 44,
                    height: 44,
                    background: urgent ? "var(--error-tint)" : "var(--lavanda-tint)",
                  }}
                >
                  <Icon
                    size={20}
                    color={urgent ? "var(--error)" : "var(--lavanda-dark)"}
                    strokeWidth={1.8}
                  />
                </div>
                <div>
                  <p className="font-head" style={{ fontSize: 16, fontWeight: 600, color: "var(--negro)" }}>
                    {row.clientName}
                  </p>
                  <p className="font-body mt-0.5" style={{ fontSize: 12, color: "var(--gris-texto)" }}>
                    {row.programName} · {row.rungName} · Mes {row.contentOrdinal}
                    {row.remaining === 0
                      ? " · sin meses por delante"
                      : ` · le queda${row.remaining === 1 ? "" : "n"} ${row.remaining} ${row.remaining === 1 ? "mes" : "meses"}`}
                  </p>
                  <p
                    className="font-body mt-1.5"
                    style={{ fontSize: 13, color: urgent ? "var(--error)" : "var(--gris-texto)" }}
                  >
                    {urgent
                      ? `Al terminar pasa a ${row.nextRungName}, que todavía no tiene ninguna serie: se queda sin contenido nuevo hasta que publiques la primera.`
                      : row.contentLoops > 0
                        ? `Ya va en su ${row.contentLoops}ª vuelta al nivel; al terminar vuelve a empezar.`
                        : "Al terminar el nivel vuelve a empezar por el Mes 1."}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
