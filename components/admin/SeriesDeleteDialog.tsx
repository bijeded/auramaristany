"use client";

interface Props {
  series: { series_number: number; title: string };
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string;
}

export function SeriesDeleteDialog({ series, onClose, onConfirm, loading, error }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
      >
        <h2 className="font-head" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          ¿Eliminar Mes {series.series_number}?
        </h2>
        <p className="font-body" style={{ fontSize: 14, color: "var(--gris-texto)", marginBottom: 20 }}>
          <strong>{series.title}</strong> y todo su contenido (días, bloques y pilares) se
          eliminarán permanentemente. Esta acción no se puede deshacer.
        </p>
        {error && (
          <p className="font-body mb-4" style={{ fontSize: 13, color: "#e05c5c" }}>{error}</p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="font-body rounded-xl px-4 py-2"
            style={{
              fontSize: 13, fontWeight: 600,
              background: "#f0f0f0", color: "var(--gris-texto)", border: "none",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="font-body rounded-xl px-4 py-2"
            style={{
              fontSize: 13, fontWeight: 600,
              background: "#e05c5c", color: "#fff", border: "none",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
