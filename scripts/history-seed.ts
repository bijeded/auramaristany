/**
 * history-seed.ts — Plan puro del historial sembrado de un cliente (sin DB).
 *
 * Cada fecha pasada del periodo se resuelve a la MISMA celda que el portal le
 * habría mostrado ese día (`getCurrentDayKey`, regla 17): no se reimplementa la
 * aritmética de semanas. El contenido sale de los bloques `exercise_list` que
 * `seed-demo.ts` lee del catálogo, así que las ediciones de Aura llegan solas.
 *
 * Determinista: el mismo periodo produce siempre el mismo historial.
 */

import { getCurrentDayKey } from '../lib/content/access'
import type { ExercisesDone, SeriesEntry } from '../lib/content/history-helpers'

export interface SeedExercise {
  id: string
  sets: number
  reps: string
  metrics: string[]
}

export interface SeedDay {
  id: string
  week_number: number
  day_of_week: string
  exercises: SeedExercise[]
}

export interface PlannedLog {
  program_day_id: string
  log_date: string // YYYY-MM-DD
  completed: boolean
  exercises_done: ExercisesDone
}

const DAY_MS = 86_400_000

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Hash estable de un id → entero pequeño, para variar pesos base sin azar. */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** Valor de una métrica en la semana `week`; nunca baja de una semana a otra. */
function metricValue(metric: string, exercise: SeedExercise, week: number): number {
  const step = week - 1
  if (metric === 'reps_done') {
    const base = parseInt(exercise.reps, 10)
    return (Number.isFinite(base) && base > 0 ? base : 10) + step
  }
  if (metric === 'weight_kg') return 4 + (hash(exercise.id) % 5) + step * 0.5
  return 10 + step
}

function logExercise(exercise: SeedExercise, week: number) {
  const sets = Math.max(1, exercise.sets || 1)
  const series: SeriesEntry[] = Array.from({ length: sets }, () =>
    Object.fromEntries(exercise.metrics.map((m) => [m, metricValue(m, exercise, week)]))
  )
  return { completed: true, series }
}

/** Posiciones fijas (proporcionales) dentro de una lista, sin repetir. */
function pick(length: number, fractions: number[], taken: Set<number>): Set<number> {
  const out = new Set<number>()
  for (const f of fractions) {
    let i = Math.min(length - 1, Math.floor(length * f))
    while (i < length && (taken.has(i) || out.has(i))) i++
    if (i < length) out.add(i)
  }
  return out
}

export function planHistory({
  periodStart,
  today,
  days,
}: {
  periodStart: Date
  today: Date
  days: SeedDay[]
}): PlannedLog[] {
  const start = utcMidnight(periodStart)
  const end = utcMidnight(today)
  const cells = new Map(days.map((d) => [`${d.week_number}:${d.day_of_week}`, d]))

  const loggable: { date: Date; day: SeedDay; week: number }[] = []
  for (let t = start; t < end; t += DAY_MS) {
    const date = new Date(t)
    const key = getCurrentDayKey(periodStart.toISOString(), date)
    if (key.day_of_week === 'domingo') continue // Descanso Activo: nunca se registra.
    const day = cells.get(`${key.week_number}:${key.day_of_week}`)
    if (!day || day.exercises.length === 0) continue
    loggable.push({ date, day, week: key.week_number })
  }

  // 2–3 días saltados; 1–2 parciales, sólo en días con más de un ejercicio
  // (un parcial omite el último ejercicio, así no baja ninguna serie).
  const skipped = pick(loggable.length, loggable.length >= 10 ? [0.3, 0.6, 0.9] : [0.4, 0.8], new Set())
  const multi = new Set(loggable.map((l, i) => (l.day.exercises.length > 1 ? -1 : i)).filter((i) => i >= 0))
  const partial = pick(loggable.length, [0.2, 0.7], new Set([...Array.from(skipped), ...Array.from(multi)]))

  return loggable.flatMap(({ date, day, week }, i) => {
    if (skipped.has(i)) return []
    const isPartial = partial.has(i)
    const exercises = isPartial ? day.exercises.slice(0, -1) : day.exercises
    return [{
      program_day_id: day.id,
      log_date: date.toISOString().split('T')[0],
      completed: !isPartial,
      exercises_done: Object.fromEntries(exercises.map((e) => [e.id, logExercise(e, week)])),
    }]
  })
}
