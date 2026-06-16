"use client";

import { useState } from "react";
import { createSeries, updateSeries } from "@/lib/admin/seriesActions";
import type { AdminVariant, AdminSeries } from "@/lib/admin/queries";

interface Props {
  programId: string;
  variants: AdminVariant[];
  mode: "create" | "edit";
  series?: Pick<
    AdminSeries,
    "id" | "series_number" | "title" | "description" | "published" | "variantIds"
  >;
  onClose: () => void;
}

export function SeriesFormModal({ programId, variants, mode, series, onClose }: Props) {
  const [title, setTitle] = useState(series?.title ?? "");
  const [description, setDescription] = useState(series?.description ?? "");
  const [seriesNumber, setSeriesNumber] = useState<number | "">(series?.series_number ?? "");
  const [published, setPublished] = useState(series?.published ?? false);
  const [selectedVariants, setSelectedVariants] = useState<string[]>(
    series?.variantIds ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function toggleVariant(id: string) {
    setSelectedVariants((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    if (!title.trim()) { setError("El título es requerido."); return; }
    if (selectedVariants.length === 0) { setError("Selecciona al menos una variante."); return; }
    if (mode === "create" && !seriesNumber) { setError("El número de mes es requerido."); return; }

    setLoading(true);

    if (mode === "create") {
      const res = await createSeries(programId, {
        series_number: Number(seriesNumber),
        title: title.trim(),
        description: description.trim() || null,
        variantIds: selectedVariants,
      });
      if (res.error) {
        if (res.error.includes("ya existe")) setFieldError(res.error);
        else setError(res.error);
        setLoading(false);
        return;
      }
    } else {
      const res = await updateSeries(series!.id, programId, {
        title: title.trim(),
        description: description.trim() || null,
        published,
        variantIds: selectedVariants,
      });
      if (res.error) { setError(res.error); setLoading(false); return; }
    }

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}
      >
        <h2 className="font-head mb-5" style={{ fontSize: 20, fontWeight: 700 }}>
          {mode === "create" ? "Nueva serie" : `Editar Mes ${series!.series_number}`}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "create" && (
            <div>
              <label className="font-body block mb-1" style={{ fontSize: 13, fontWeight: 600 }}>
                Mes #
              </label>
              <input
                type="number"
                min={1}
                value={seriesNumber}
                onChange={(e) => {
                  setSeriesNumber(e.target.value === "" ? "" : Number(e.target.value));
                  setFieldError(null);
                }}
                className="font-body w-full rounded-xl px-3 py-2"
                style={{
                  fontSize: 14,
                  border: `1.5px solid ${fieldError ? "#e05c5c" : "var(--gris-linea)"}`,
                }}
                required
              />
              {fieldError && (
                <p className="font-body mt-1" style={{ fontSize: 12, color: "#e05c5c" }}>
                  {fieldError}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="font-body block mb-1" style={{ fontSize: 13, fontWeight: 600 }}>
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-body w-full rounded-xl px-3 py-2"
              style={{ fontSize: 14, border: "1.5px solid var(--gris-linea)" }}
              required
            />
          </div>

          <div>
            <label className="font-body block mb-1" style={{ fontSize: 13, fontWeight: 600 }}>
              Descripción{" "}
              <span style={{ fontWeight: 400, color: "var(--gris-texto)" }}>(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="font-body w-full rounded-xl px-3 py-2"
              style={{ fontSize: 14, border: "1.5px solid var(--gris-linea)", resize: "vertical" }}
            />
          </div>

          {mode === "edit" && (
            <label
              className="flex items-center gap-2 cursor-pointer font-body"
              style={{ fontSize: 14 }}
            >
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Publicado
            </label>
          )}

          <div>
            <p className="font-body mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
              Variantes
            </p>
            <div className="flex flex-col gap-2">
              {variants.map((v) => (
                <label
                  key={v.id}
                  className="flex items-center gap-2 cursor-pointer font-body"
                  style={{ fontSize: 14 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedVariants.includes(v.id)}
                    onChange={() => toggleVariant(v.id)}
                    className="w-4 h-4 rounded"
                  />
                  {v.name}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="font-body" style={{ fontSize: 13, color: "#e05c5c" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-2">
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
              type="submit"
              disabled={loading}
              className="font-body rounded-xl px-4 py-2"
              style={{
                fontSize: 13, fontWeight: 600,
                background: "var(--lavanda-dark)", color: "#fff", border: "none",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading
                ? "Guardando…"
                : mode === "create"
                ? "Crear serie"
                : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
