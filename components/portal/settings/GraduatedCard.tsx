import Link from "next/link";
import { extraCheckoutSlugForLevel } from "@/lib/portal/graduation";

/**
 * Lo que ve una clienta que terminó su programa.
 *
 * Celebra el logro y le dice qué sigue, en el mismo sitio donde ya están su
 * cuenta, sus pagos y su historial: terminar no es quedarse fuera.
 */
export function GraduatedCard({
  programName,
  rungLevel,
}: {
  programName: string;
  rungLevel: string | null;
}) {
  const href = `/checkout/${extraCheckoutSlugForLevel(rungLevel)}`;

  return (
    <div
      className="rounded-xl bg-white p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <h2 className="font-head" style={{ fontSize: 18, color: "var(--negro)", marginBottom: 6 }}>
        ¡Terminaste {programName}!
      </h2>
      <p className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>
        Completaste todo el programa. Tu historial, tus fotos y tus pagos siguen aquí, son tuyos.
        Cuando quieras seguir, te espera CuarentaMás Extra para no perder lo que ganaste.
      </p>
      <Link
        href={href}
        className="font-head w-full rounded-xl"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          fontWeight: 500,
          minHeight: 48,
          marginTop: 14,
          background: "var(--lavanda)",
          color: "#fff",
          textDecoration: "none",
        }}
      >
        Seguir con CuarentaMás Extra
      </Link>
    </div>
  );
}
