"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, Download } from "lucide-react";
import {
  filterClients, clientsToCSV, canDeleteClient,
  nextChargeCell, statusBadge, STATUS_FILTERS, isInactive, INACTIVITY_THRESHOLD_DAYS,
  type ClientListRow, type StatusFilter,
} from "@/lib/admin/clients-helpers";
import { paginate } from "@/lib/admin/pagination";
import { dayLabel, relativeDayLabel } from "@/lib/admin/date-helpers";

export function ClientsTable({
  rows,
  now,
  initialStatus = null,
}: {
  rows: ClientListRow[];
  now: string;
  /** D17 — cohorte preseleccionada al llegar desde una tarjeta del dashboard. */
  initialStatus?: StatusFilter;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [prog, setProg] = useState("Todas");
  const [estado, setEstado] = useState<StatusFilter>(initialStatus);
  const [page, setPage] = useState(1);

  const programs = useMemo(() => ["Todas", ...Array.from(new Set(rows.map((r) => r.program_name))).sort()], [rows]);
  const activas = rows.filter((r) => r.status === "active").length;
  const filtered = filterClients(rows, { query: q, program: prog, status: estado, now });
  const { items, totalPages, page: current } = paginate(filtered, page);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  function exportCSV() {
    const csv = clientsToCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clientes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(row: ClientListRow, e: React.MouseEvent) {
    e.stopPropagation();
    const guard = canDeleteClient([{ status: row.status }]);
    if (!guard.ok) return;
    if (!confirm(`¿Eliminar a ${row.full_name}? Se borrarán todos los datos, fotos y registros. Es irreversible.`)) return;
    const res = await fetch(`/api/admin/clients/${row.profile_id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "No se pudo eliminar.");
    }
  }

  return (
    // 1040 alcanzaba para seis columnas; "Último acceso" es la séptima y la más
    // ancha de la fila ("Cobro / acceso") ya lleva fecha y monto en dos líneas.
    <div style={{ padding: "28px 32px 40px", maxWidth: 1200 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <h1 className="font-head" style={{ fontSize: 28, fontWeight: 700 }}>
          Clientes <span style={{ fontSize: 17, color: "var(--gris-texto)", fontWeight: 400 }}>({activas} activas)</span>
        </h1>
        <div className="flex gap-2 items-center">
          <div style={{ position: "relative", width: 260 }}>
            <span style={{ position: "absolute", left: 12, top: 11 }}><Search size={17} color="var(--gris-suave)" /></span>
            <input value={q} onChange={(e) => resetPage(setQ)(e.target.value)} placeholder="Buscar por nombre o correo..."
              className="font-body" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--gris-linea)", fontSize: 14 }} />
          </div>
          <button onClick={exportCSV} className="font-body flex items-center gap-2"
            style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 10, padding: "10px 14px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros: programa (pills) + estado (select).
          Los siete filtros de estado eran pills y, con los de programa, sumaban
          once controles en una fila de 1040px: se partían en dos renglones por
          la mitad del grupo de estado, lo que se leía como un error de render.
          La lista de programas sale de los datos, así que un programa más lo
          empeoraba solo. El select quita el salto de raíz y deja la fila
          insensible a cuántos programas existan. */}
      <div className="flex gap-2 flex-wrap items-center" style={{ marginBottom: 20 }}>
        {programs.map((f) => (
          <button key={f} className={"pill " + (prog === f ? "active" : "")} onClick={() => resetPage(setProg)(f)}>{f}</button>
        ))}
        {/* Las opciones salen ENTERAS de STATUS_FILTERS. La única escrita a mano
            es el centinela de "sin filtro", que no es un valor de filtro sino su
            ausencia: una opción literal al lado de una lista mapeada es una
            segunda copia de la tabla, y es como el modal de cancelación ofreció
            "Prefiero no decir" durante meses (D19). */}
        <label className="font-body" style={{ marginLeft: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--gris-texto)" }}>
          <span>Estado</span>
          <select
            value={estado ?? ""}
            onChange={(e) => resetPage(setEstado)((e.target.value || null) as StatusFilter)}
            className="font-body"
            style={{
              minHeight: 44, borderRadius: 999, border: "1px solid var(--gris-linea)",
              background: "#fff", color: "var(--gris-texto)", padding: "0 14px",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <option value="">Todos los estados</option>
            {STATUS_FILTERS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14, marginBottom: 12 }}>No hay clientes con esos filtros.</p>
          <button onClick={() => { setQ(""); setProg("Todas"); setEstado(null); setPage(1); }}
            className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Limpiar filtros
          </button>
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--gris-claro)" }}>
                {["Cliente", "Programa", "Inscripción", "Cobro / acceso", "Estado", "Último acceso", ""].map((h, i) => (
                  <th key={i} style={{ textAlign: "left", padding: "12px 20px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.map((c) => {
                  const badge = statusBadge(c.status);
                  const canDel = canDeleteClient([{ status: c.status }]).ok;
                  return (
                    <tr key={c.profile_id} style={{ borderTop: "1px solid var(--gris-linea)", cursor: "pointer" }}
                      onClick={() => router.push(`/admin/clients/${c.profile_id}`)}>
                      <td style={{ padding: "12px 20px" }}>
                        <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{c.full_name}</div>
                        <div className="font-body" style={{ color: "var(--gris-suave)", fontSize: 12 }}>{c.email}</div>
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span className="font-body" style={{ display: "inline-block", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "var(--lavanda-soft)", color: "var(--lavanda-dark)", whiteSpace: "nowrap" }}>{c.program_name}</span>
                        <div className="font-body" style={{ color: "var(--gris-suave)", fontSize: 12, marginTop: 4 }}>{c.variant_name}</div>
                      </td>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--gris-texto)" }}>{dayLabel(c.enrollment_date)}</td>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--gris-texto)" }}>
                        {(() => {
                          const cell = nextChargeCell(c);
                          return (
                            <>
                              {cell.kind === "ending" && (
                                <div className="font-body" style={{ fontSize: 11.5, color: "var(--gris-texto)" }}>
                                  {cell.label}
                                </div>
                              )}
                              {cell.value}
                            </>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span className="font-body" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </td>
                      {/* Último acceso. La pregunta que Aura trae al abrir esta
                          pantalla es "¿quién lleva días sin entrar?", y hasta
                          ahora sólo se contestaba filtrando a propósito.
                          El umbral NO se recalcula aquí: lo decide `isInactive`,
                          el mismo que usan el filtro "Sin actividad" y el cron
                          A4, para que siga habiendo una sola definición. */}
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5 }}>
                        {(() => {
                          const quiet = isInactive(c.last_activity_date, now, INACTIVITY_THRESHOLD_DAYS);
                          const color = quiet ? "var(--inactivo)" : "var(--gris-texto)";
                          // "Sin registros" y no "—": no es un dato que falte,
                          // es que nunca registró. Distingue no haber empezado
                          // de haber dejado de entrar.
                          if (c.last_activity_date === null) {
                            return <span style={{ color, fontWeight: 600 }}>Sin registros</span>;
                          }
                          return (
                            <>
                              <div style={{ color, fontWeight: quiet ? 600 : 400 }}>
                                {relativeDayLabel(c.last_activity_date, now)}
                              </div>
                              <div style={{ color: "var(--gris-suave)", fontSize: 12, marginTop: 2 }}>
                                {dayLabel(c.last_activity_date)}
                              </div>
                            </>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "12px 20px", textAlign: "right" }}>
                        <button onClick={(e) => handleDelete(c, e)} disabled={!canDel}
                          title={canDel ? "Eliminar" : "Tiene una suscripción activa"}
                          style={{ background: "none", border: "none", cursor: canDel ? "pointer" : "not-allowed", color: canDel ? "var(--error)" : "var(--gris-linea)" }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
            <span className="font-body" style={{ fontSize: 12.5, color: "var(--gris-texto)" }}>
              Mostrando {(current - 1) * 10 + 1}–{Math.min(current * 10, filtered.length)} de {filtered.length}
            </span>
            <div className="flex gap-2">
              <button disabled={current <= 1} onClick={() => setPage(current - 1)}
                className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: current <= 1 ? "not-allowed" : "pointer", opacity: current <= 1 ? 0.5 : 1 }}>Anterior</button>
              <button disabled={current >= totalPages} onClick={() => setPage(current + 1)}
                className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: current >= totalPages ? "not-allowed" : "pointer", opacity: current >= totalPages ? 0.5 : 1 }}>Siguiente</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
