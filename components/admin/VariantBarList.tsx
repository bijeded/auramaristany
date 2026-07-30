export interface VariantBarRow {
  label: string;
  /** Magnitud que define el ancho de la barra. */
  value: number;
  /** Ya formateado por quien llama: "2" o "$9,990". */
  display: string;
}

/**
 * Lista de barras horizontales de las dos tarjetas de variante del dashboard.
 *
 * UN componente y dos instancias, no dos bloques de JSX parecidos: dos tarjetas
 * de anatomía idéntica que se editan por separado son la tabla copiada de la
 * regla 8, aquí en JSX. Cualquier ajuste de fila tiene que llegar a las dos.
 *
 * `display` viene ya formateado en vez de un `formatMXN` opcional o un flag de
 * "¿soy la de dinero?": así el componente no conoce ninguna de las dos tarjetas.
 *
 * Cada tarjeta se escala contra SU propio máximo. Las dos no comparten escala —
 * miden unidades distintas (personas y pesos) y una escala común no significaría
 * nada.
 *
 * Server Component: no hay interactividad que justifique "use client".
 */
export function VariantBarList({
  rows,
  fill,
  emptyMessage,
}: {
  rows: VariantBarRow[];
  fill: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
        {emptyMessage}
      </p>
    );
  }

  // Piso de 1 para no dividir entre 0 si todas las filas valen 0.
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {rows.map((r) => (
        <div key={r.label}>
          {/* `baseline` y no el `space-between` a secas de antes: a media
              columna un nombre de variante de 42 caracteres se parte en dos
              líneas, y sin esto la cifra se iba con él. `nowrap` evita que
              "$9,990" se rompa a la mitad. */}
          <div
            className="flex"
            style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}
          >
            <span className="font-body" style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</span>
            <span className="font-body" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
              {r.display}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--gris-claro)" }}>
            <div style={{ height: 8, borderRadius: 4, width: `${(r.value / max) * 100}%`, background: fill }} />
          </div>
        </div>
      ))}
    </div>
  );
}
