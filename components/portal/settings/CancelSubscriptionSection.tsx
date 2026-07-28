"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelSubscription, reactivateSubscription } from "@/lib/portal/settingsActions";
import {
  CANCELLATION_REASON_OPTIONS,
  reasonRequiresDetail,
  type CancellationState,
} from "@/lib/portal/cancellation";
import type { CancellationReason } from "@/lib/supabase/types";
import { longDateLabel } from "@/lib/admin/date-helpers";
import { Button } from "@/components/ui/button";

export function CancelSubscriptionSection({ state }: { state: CancellationState }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `completed` no ofrece nada aquí: ni Reactivar (reanudaría el cobro de un
  // programa que ya terminó) ni Cancelar mi plan (invitaría a cancelar algo que
  // ya se acabó). Lo que le toca a la graduada lo dice la GraduatedCard.
  if (state.kind === "none" || state.kind === "completed") return null;

  async function reactivate() {
    setBusy(true);
    setError(null);
    const res = await reactivateSubscription();
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }

  if (state.kind === "grace") {
    return (
      <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <p className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>
          Tu plan termina el{" "}
          <span style={{ fontWeight: 600, color: "var(--negro)" }}>
            {state.endsAt ? longDateLabel(state.endsAt) : "final del periodo"}
          </span>
          . Seguirás con acceso hasta esa fecha.
        </p>
        {error && <p className="font-body text-sm" style={{ color: "var(--error)", marginTop: 8 }}>{error}</p>}
        <button
          type="button"
          onClick={reactivate}
          disabled={busy}
          className="font-head w-full rounded-xl mt-3"
          style={{
            fontSize: 15, fontWeight: 500, minHeight: 48,
            background: "var(--lavanda)", color: "#fff", border: "none", opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Reactivando…" : "Reactivar mi plan"}
        </button>
      </div>
    );
  }

  // state.kind === "eligible"
  return (
    <>
      <Button
        className="w-full"
        style={{ background: "#fff", color: "var(--error)" }}
        onClick={() => setModalOpen(true)}
      >
        Cancelar mi plan
      </Button>
      {modalOpen && (
        <CancelSurveyModal
          onClose={() => setModalOpen(false)}
          onDone={() => { setModalOpen(false); router.refresh(); }}
        />
      )}
    </>
  );
}

function CancelSurveyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const showDetail = reason !== null && reasonRequiresDetail(reason);

  // Focus the dialog heading on open and allow Escape to close (unless busy).
  useEffect(() => {
    headingRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await cancelSubscription({
      reason: reason ?? undefined,
      detail: showDetail ? detail.trim() || undefined : undefined,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        className="bg-white rounded-2xl p-6 w-full max-w-md"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}
      >
        <h2 ref={headingRef} tabIndex={-1} id="cancel-modal-title" className="font-head mb-2" style={{ fontSize: 20, fontWeight: 700, outline: "none" }}>
          Cancelar mi plan
        </h2>
        <p className="font-body mb-4" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
          Tu plan seguirá activo hasta el final del periodo que ya pagaste. Si quieres, cuéntanos por qué te vas —
          es opcional y nos ayuda a mejorar.
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {CANCELLATION_REASON_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer font-body" style={{ fontSize: 14, minHeight: 44 }}>
              <input
                type="radio"
                name="cancel-reason"
                checked={reason === opt.value}
                onChange={() => setReason(opt.value)}
                className="w-4 h-4"
              />
              {opt.label}
            </label>
          ))}
          <label className="flex items-center gap-2.5 cursor-pointer font-body" style={{ fontSize: 14, minHeight: 44, color: "var(--gris-texto)" }}>
            <input
              type="radio"
              name="cancel-reason"
              checked={reason === null}
              onChange={() => setReason(null)}
              className="w-4 h-4"
            />
            Prefiero no decir
          </label>
        </div>

        {showDetail && (
          <div className="mb-3">
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={200}
              rows={2}
              aria-label={reason === "encontre_otra_opcion" ? "¿Cuál otra opción encontraste?" : "Cuéntanos más"}
              placeholder={reason === "encontre_otra_opcion" ? "¿Cuál?" : "Cuéntanos más (opcional)"}
              className="font-body w-full rounded-xl px-3 py-2"
              style={{ fontSize: 14, border: "1.5px solid var(--gris-linea)", resize: "vertical" }}
            />
            <p className="font-body text-right" style={{ fontSize: 11, color: "var(--gris-suave)" }}>{detail.length}/200</p>
          </div>
        )}

        {error && <p className="font-body mb-2" style={{ fontSize: 13, color: "var(--error)" }}>{error}</p>}

        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="font-body rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, minHeight: 44, padding: "0 16px", background: "#f0f0f0", color: "var(--gris-texto)", border: "none" }}
          >
            Mantener mi plan
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="font-body rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, minHeight: 44, padding: "0 16px", background: "var(--error)", color: "#fff", border: "none", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Cancelando…" : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
}
