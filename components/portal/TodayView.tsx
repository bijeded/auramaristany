"use client";

import { Clock, Dumbbell, Moon, CheckCircle2, Loader2 } from "lucide-react";
import type { TodayContent, DayBlock } from "@/lib/content/queries";
import { TextBlock } from "./blocks/TextBlock";
import { YoutubeBlock } from "./blocks/YoutubeBlock";
import { PdfBlock } from "./blocks/PdfBlock";
import { ImageBlock } from "./blocks/ImageBlock";
import { ExerciseListBlock } from "./blocks/ExerciseListBlock";
import { useProgressForm } from "@/hooks/useProgressForm";
import type { ExerciseSeriesEntry } from "@/hooks/useProgressForm";

const PROGRAM_NAMES: Record<string, string> = {
  "cuarenta-mas": "CuarentaMás",
  "cuarenta-mas-extra": "CuarentaMás Extra",
  "strong-fit": "Strong & Fit",
};

const DAY_LABELS: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

function formatDate(isoDate?: string): string {
  const date = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
  const str = date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function ProgramBanner({
  monthsElapsed,
  weekNumber,
  programSlug,
}: {
  monthsElapsed: number;
  weekNumber: number;
  programSlug: string;
}) {
  const programName = PROGRAM_NAMES[programSlug] ?? programSlug;
  const weekProgress = weekNumber / 4;

  return (
    <div
      className="rounded-xl p-4 mb-5"
      style={{ background: "rgb(242,242,242)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p
            className="font-body"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "#a87b73",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
            }}
          >
            Tu progreso
          </p>
          <p
            className="font-head mt-0.5"
            style={{ fontSize: 22, fontWeight: 600, color: "#5e3d38" }}
          >
            Mes {monthsElapsed}{" "}
            <span style={{ fontSize: 15, color: "#a87b73", fontWeight: 400 }}>
              · Semana {weekNumber}
            </span>
          </p>
        </div>
        <span
          className="font-body rounded-full px-3 py-1.5 text-center"
          style={{
            fontSize: 11.5,
            background: "rgba(255,255,255,0.7)",
            color: "#7a5048",
          }}
        >
          {programName}
        </span>
      </div>
      <div
        className="rounded-full overflow-hidden"
        style={{ height: 6, background: "rgba(168,123,115,0.3)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${weekProgress * 100}%`,
            background: "var(--lavanda)",
          }}
        />
      </div>
    </div>
  );
}

function DayHeader({
  title,
  workoutFocus,
  dayType,
  durationMinutes,
  dayOfWeek,
}: {
  title: string;
  workoutFocus: string | null;
  dayType: string;
  durationMinutes: number | null;
  dayOfWeek: string;
}) {
  return (
    <div className="mb-5">
      <p
        className="font-body mb-2"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--gris-texto)",
          letterSpacing: "0.6px",
          textTransform: "uppercase",
        }}
      >
        Hoy · {DAY_LABELS[dayOfWeek] ?? dayOfWeek}
      </p>
      <h1
        className="font-head mb-3"
        style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}
      >
        {title}
      </h1>
      <div className="flex gap-2 flex-wrap">
        {workoutFocus && (
          <span
            className="flex items-center gap-1.5 font-body rounded-full px-3 py-1"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              background: "var(--lavanda-tint)",
              color: "var(--lavanda-dark)",
            }}
          >
            <Dumbbell size={13} />
            {workoutFocus}
          </span>
        )}
        {dayType === "workout" && durationMinutes && (
          <span
            className="flex items-center gap-1.5 font-body rounded-full px-3 py-1"
            style={{
              fontSize: 12.5,
              background: "var(--gris-claro)",
              color: "var(--gris-texto)",
            }}
          >
            <Clock size={13} />
            {durationMinutes} minutos
          </span>
        )}
      </div>
    </div>
  );
}

function RestDayCard() {
  return (
    <div
      className="rounded-xl p-8 text-center mb-5"
      style={{ background: "var(--rosa)" }}
    >
      <div
        className="flex items-center justify-center rounded-full mx-auto mb-4"
        style={{
          width: 60,
          height: 60,
          background: "rgba(255,255,255,0.6)",
        }}
      >
        <Moon size={28} color="var(--lavanda-dark)" />
      </div>
      <h2
        className="font-head mb-2"
        style={{ fontSize: 20, fontWeight: 600, color: "#5e3d38" }}
      >
        Hoy es día de descanso
      </h2>
      <p
        className="font-body"
        style={{ color: "#7a5048", maxWidth: 300, margin: "0 auto" }}
      >
        Tu cuerpo crece cuando descansa. Camina ligero, hidrátate y duerme
        bien. Mañana volvemos con todo.
      </p>
    </div>
  );
}

function ContentNotAvailableCard() {
  return (
    <div
      className="rounded-xl p-8 text-center mb-5 bg-white"
      style={{ border: "1px solid var(--gris-linea)" }}
    >
      <div
        className="flex items-center justify-center rounded-full mx-auto mb-4"
        style={{
          width: 60,
          height: 60,
          background: "var(--lavanda-tint)",
        }}
      >
        <Clock size={28} color="var(--lavanda)" />
      </div>
      <h2
        className="font-head mb-2"
        style={{ fontSize: 18, fontWeight: 600 }}
      >
        El contenido de hoy estará disponible pronto
      </h2>
      <p className="font-body" style={{ color: "var(--gris-texto)", maxWidth: 280, margin: "0 auto" }}>
        Aura está preparando tu programa. Vuelve en un ratito.
      </p>
    </div>
  );
}

function SaveStatusBar({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;

  return (
    <div
      className="flex items-center justify-center gap-2 py-2 font-body"
      style={{ fontSize: 12, color: status === "error" ? "#e05c5c" : "var(--gris-texto)" }}
    >
      {status === "saving" && (
        <>
          <Loader2 size={13} className="animate-spin" />
          Guardando...
        </>
      )}
      {status === "saved" && (
        <>
          <CheckCircle2 size={13} color="#4caf7d" />
          <span style={{ color: "#3a8c60" }}>Guardado</span>
        </>
      )}
      {status === "error" && "Error al guardar. Revisa tu conexión."}
    </div>
  );
}

function BlockRenderer({
  block,
  formState,
  onUpdateCompleted,
  onUpdateSeries,
}: {
  block: DayBlock;
  formState: ReturnType<typeof useProgressForm>["exercises"];
  onUpdateCompleted: (exerciseId: string, completed: boolean) => void;
  onUpdateSeries: (exerciseId: string, index: number, field: keyof ExerciseSeriesEntry, value: string) => void;
}) {
  switch (block.block_type) {
    case "text":
      return <TextBlock content={block.content as { html: string }} />;
    case "youtube":
      return (
        <YoutubeBlock
          content={block.content as { video_id: string; title: string }}
        />
      );
    case "pdf":
      return (
        <PdfBlock
          content={
            block.content as {
              storage_path: string;
              filename: string;
              label: string;
            }
          }
        />
      );
    case "image":
      return (
        <ImageBlock
          content={block.content as { storage_path: string; alt: string }}
        />
      );
    case "exercise_list":
      return (
        <ExerciseListBlock
          content={
            block.content as {
              exercises: Parameters<typeof ExerciseListBlock>[0]["content"]["exercises"];
            }
          }
          formState={formState}
          onUpdateCompleted={onUpdateCompleted}
          onUpdateSeries={onUpdateSeries}
        />
      );
    default:
      return null;
  }
}

export function TodayView({ content }: { content: TodayContent | null }) {
  const exerciseDefs = content?.blocks
    .filter((b) => b.block_type === "exercise_list")
    .flatMap((b) =>
      (b.content as { exercises: { id: string; sets: number }[] }).exercises
    )
    .map(({ id, sets }) => ({ id, sets })) ?? [];

  const { exercises, generalNotes, saveStatus, updateCompleted, updateSeries, updateGeneralNotes } =
    useProgressForm({
      dayId: content?.day.id ?? "",
      subscriptionId: content?.subscriptionId ?? "",
      existingLog: content?.existingLog ?? null,
      exercises: exerciseDefs,
    });

  return (
    <div style={{ background: "var(--rosa-soft)" }}>
      {/* Sticky top bar — always visible */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4"
        style={{
          height: 52,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--gris-linea)",
        }}
      >
        <span
          className="font-head font-semibold tracking-widest uppercase"
          style={{ fontSize: 16, letterSpacing: "0.18em" }}
        >
          AURA
        </span>
        <span
          className="font-body"
          style={{ fontSize: 13, color: "var(--gris-texto)" }}
        >
          {formatDate(content?.effectiveDate)}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="px-4 pt-4 pb-8">
        {!content ? (
          <RestDayCard />
        ) : (
          <>
            <ProgramBanner
              monthsElapsed={content.monthsElapsed}
              weekNumber={content.currentDayKey.week_number}
              programSlug={content.programSlug}
            />

            {content.day.workout_focus === null ? (
              <RestDayCard />
            ) : content.blocks.length === 0 ? (
              <ContentNotAvailableCard />
            ) : (
              <>
                <DayHeader
                  title={content.day.title}
                  workoutFocus={content.day.workout_focus}
                  dayType={content.day.day_type}
                  durationMinutes={content.day.duration_minutes}
                  dayOfWeek={content.currentDayKey.day_of_week}
                />

                {content.blocks.map((block) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    formState={exercises}
                    onUpdateCompleted={updateCompleted}
                    onUpdateSeries={updateSeries}
                  />
                ))}

                <div className="mb-4">
                  <label
                    className="block font-body mb-2"
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--negro)" }}
                  >
                    Mis notas de hoy{" "}
                    <span style={{ fontWeight: 400, color: "var(--gris-texto)" }}>
                      (opcional)
                    </span>
                  </label>
                  <textarea
                    value={generalNotes}
                    onChange={(e) => updateGeneralNotes(e.target.value)}
                    placeholder="¿Cómo te sentiste? ¿Algo que quieras recordar?"
                    rows={3}
                    className="w-full font-body rounded-xl resize-none"
                    style={{
                      padding: "12px 14px",
                      background: "var(--gris-claro)",
                      border: "1.5px solid transparent",
                      fontSize: 14,
                      outline: "none",
                      color: "var(--negro)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--lavanda)")}
                    onBlur={(e) => (e.target.style.borderColor = "transparent")}
                  />
                </div>

                <SaveStatusBar status={saveStatus} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
