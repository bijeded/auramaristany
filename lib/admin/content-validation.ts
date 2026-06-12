import { z } from "zod";

export type ValidationResult = { ok: true } | { ok: false; error: string };

const DAY_TYPES = ["workout", "rest", "cardio"] as const;
const BLOCK_TYPES = ["text", "youtube", "pdf", "image", "cardio_zone2", "exercise_list"] as const;

const daySchema = z.object({
  title: z.string().trim().min(1).max(200),
  weekNumber: z.number().int().min(1).max(4),
  dayType: z.enum(DAY_TYPES),
  durationMinutes: z.number().int().min(0).max(600).nullable(),
  workoutFocus: z.string().max(120).nullable(),
});

export function validateDayInput(input: unknown): ValidationResult {
  const r = daySchema.safeParse(input);
  return r.success ? { ok: true } : { ok: false, error: "Datos del día inválidos" };
}

const pillarSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export function validatePillarInput(input: { title: string }): ValidationResult {
  const r = pillarSchema.safeParse(input);
  return r.success ? { ok: true } : { ok: false, error: "Datos del pilar inválidos" };
}

export function validateBlock(block: { block_type: string; content: Record<string, unknown> }): ValidationResult {
  if (!(BLOCK_TYPES as readonly string[]).includes(block.block_type)) {
    return { ok: false, error: "Tipo de bloque no permitido" };
  }
  if (block.block_type === "text") {
    const html = (block.content as { html?: unknown }).html;
    if (typeof html === "string" && html.length > 50000) {
      return { ok: false, error: "Contenido de texto demasiado largo" };
    }
  }
  return { ok: true };
}
