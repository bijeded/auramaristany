"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import {
  updateAutomatedMessage,
  toggleAutomatedMessage,
} from "@/lib/admin/automatedMessageActions";
import { MESSAGE_BODY_MAX, MESSAGE_SUBJECT_MAX } from "@/lib/admin/message-helpers";
import type { NoticeRule } from "@/lib/supabase/types";

export interface AutomatedMessageRow {
  rule: NoticeRule;
  subject: string;
  body: string;
  is_active: boolean;
}

// Cada regla se dispara desde `lib/cron/notice-rules.ts`; aquí sólo se explica
// cuándo sale, para que el texto que escriba Aura encaje con el momento.
const RULE_META: Record<NoticeRule, { label: string; trigger: string; help?: string }> = {
  booking_reminder: {
    label: "Recordatorio para agendar llamada",
    trigger:
      "Sale el primer día en que el cliente ve un bloque «Agendar» en su día de hoy. No se envía si ya tiene una llamada futura agendada, si canceló su suscripción o si tiene un pago pendiente.",
    help: "Coloca los bloques «Agendar» en la semana 1 y la semana 3 del mes. El contenido es una malla de semana + día, no una lista de días numerados: cada cliente la recorre desde su propia fecha de inicio, así que «día 1» y «día 15» significan fechas distintas para cada quien. Si mueves los bloques, el recordatorio se mueve contigo, sin tocar código.",
  },
  inactivity_nudge: {
    label: "Recordatorio por inactividad",
    trigger:
      "Sale cuando el cliente lleva 10 días o más sin registrar avance. Se envía una sola vez por racha: si vuelve y se ausenta de nuevo, recibe otro. No se envía si canceló su suscripción.",
  },
};

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className="font-body"
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: active ? "var(--lavanda-soft)" : "var(--error-tint)",
        color: active ? "var(--lavanda-dark)" : "var(--error)",
      }}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--gris-linea)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  background: "#fff",
};

function RuleCard({ row }: { row: AutomatedMessageRow }) {
  const router = useRouter();
  const meta = RULE_META[row.rule];
  const [subject, setSubject] = useState(row.subject);
  const [body, setBody] = useState(row.body);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = subject !== row.subject || body !== row.body;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await updateAutomatedMessage({ rule: row.rule, subject, body });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function toggle() {
    setToggling(true);
    setError(null);
    const res = await toggleAutomatedMessage(row.rule, !row.is_active);
    setToggling(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section
      style={{
        border: "1px solid var(--gris-linea)",
        borderRadius: 12,
        background: "#fff",
        padding: "18px 20px",
        marginBottom: 18,
      }}
    >
      <div className="flex items-start justify-between gap-3" style={{ marginBottom: 6 }}>
        <div className="flex items-center gap-2">
          <h2 className="font-head" style={{ fontSize: 17, fontWeight: 700 }}>
            {meta.label}
          </h2>
          <Badge active={row.is_active} />
        </div>
        <button
          onClick={toggle}
          disabled={toggling}
          className="font-body"
          style={{
            background: "#fff",
            border: "1px solid var(--gris-linea)",
            borderRadius: 8,
            padding: "8px 12px",
            minHeight: 44,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: toggling ? "wait" : "pointer",
            color: "var(--gris-texto)",
            flexShrink: 0,
          }}
        >
          {row.is_active ? "Desactivar" : "Activar"}
        </button>
      </div>

      <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 13, marginBottom: 4 }}>
        {meta.trigger}
      </p>
      {meta.help && (
        <p
          className="font-body"
          style={{
            color: "var(--gris-texto)",
            fontSize: 12.5,
            background: "var(--gris-claro)",
            borderRadius: 8,
            padding: "9px 11px",
            margin: "8px 0 0",
          }}
        >
          {meta.help}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <label
          className="font-body"
          htmlFor={`subject-${row.rule}`}
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}
        >
          Asunto
        </label>
        <input
          id={`subject-${row.rule}`}
          className="font-body"
          value={subject}
          maxLength={MESSAGE_SUBJECT_MAX}
          onChange={(e) => {
            setSubject(e.target.value);
            setSaved(false);
          }}
          style={inputStyle}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label
          className="font-body"
          htmlFor={`body-${row.rule}`}
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}
        >
          Mensaje
        </label>
        <textarea
          id={`body-${row.rule}`}
          className="font-body"
          value={body}
          rows={8}
          maxLength={MESSAGE_BODY_MAX}
          onChange={(e) => {
            setBody(e.target.value);
            setSaved(false);
          }}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
        />
        <div
          className="flex items-center justify-between gap-3"
          style={{ marginTop: 6, fontSize: 12 }}
        >
          <span className="font-body" style={{ color: "var(--gris-texto)" }}>
            Puedes usar <code>{"{nombre}"}</code>: se reemplaza por el nombre de cada cliente. Se
            envía tal cual lo escribes, con tus saltos de línea; cualquier otra cosa entre llaves
            se manda literal.
          </span>
          <span
            className="font-body"
            style={{ color: "var(--gris-suave)", flexShrink: 0 }}
          >
            {body.length}/{MESSAGE_BODY_MAX}
          </span>
        </div>
      </div>

      {error && (
        <p className="font-body" style={{ color: "var(--error)", fontSize: 13, marginTop: 12 }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3" style={{ marginTop: 16 }}>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="font-body flex items-center gap-2"
          style={{
            background: dirty ? "var(--lavanda)" : "var(--gris-claro)",
            color: dirty ? "#fff" : "var(--gris-suave)",
            border: "none",
            borderRadius: 10,
            padding: "0 18px",
            minHeight: 48,
            fontWeight: 600,
            fontSize: 13.5,
            cursor: saving || !dirty ? "default" : "pointer",
          }}
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {saved && !dirty && (
          <span
            className="font-body flex items-center gap-1"
            style={{ color: "var(--lavanda-dark)", fontSize: 13, fontWeight: 600 }}
          >
            <Check size={15} /> Guardado
          </span>
        )}
      </div>
    </section>
  );
}

export function AutomatedMessagesEditor({ rows }: { rows: AutomatedMessageRow[] }) {
  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 760 }}>
      <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
        Mensajes automáticos
      </h1>
      <p
        className="font-body"
        style={{ color: "var(--gris-texto)", fontSize: 13.5, marginBottom: 22 }}
      >
        Estos mensajes se envían solos, una vez al día, al portal del cliente y a su correo. Aquí
        editas el texto y decides si cada uno está activo. No se pueden crear ni borrar: cada regla
        tiene su disparador programado.
      </p>

      {rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 48,
            border: "1px dashed var(--gris-linea)",
            borderRadius: 12,
          }}
        >
          <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>
            No se pudieron cargar los mensajes automáticos.
          </p>
        </div>
      ) : (
        rows.map((row) => <RuleCard key={row.rule} row={row} />)
      )}
    </div>
  );
}
