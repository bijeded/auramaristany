export type DayOfWeek =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export interface DayKey {
  week_number: number; // 1–4
  day_of_week: DayOfWeek;
}

export interface AccessibleSeries {
  series_number: number;
  fully_accessible: boolean; // false = restricted to current week/day
}

const DAY_ORDER: Record<DayOfWeek, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
};

// JS getDay() → DayOfWeek (0=domingo, 1=lunes, …)
const JS_DAY_TO_DOW: DayOfWeek[] = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

export function toDayOfWeek(date: Date): DayOfWeek {
  return JS_DAY_TO_DOW[date.getDay()];
}

/**
 * Computes (week_number, day_of_week) for `today` within a Stripe billing period.
 * Uses UTC date arithmetic to avoid timezone drift.
 * week_number is clamped to 4 (the model only defines weeks 1–4).
 */
export function getCurrentDayKey(
  currentPeriodStart: string,
  today = new Date()
): DayKey {
  const start = new Date(currentPeriodStart);
  const startUTC = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );
  const todayUTC = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const daysElapsed = Math.max(
    0,
    Math.floor((todayUTC - startUTC) / 86_400_000)
  );
  const week_number = Math.min(Math.floor(daysElapsed / 7) + 1, 4);
  const day_of_week = toDayOfWeek(today);
  return { week_number, day_of_week };
}

/**
 * Returns true when (dayWeekNumber, dayDayOfWeek) is on or before the current position.
 * Used to gate whether a specific day's content is visible to the client.
 */
export function isDayAccessible(
  dayWeekNumber: number,
  dayDayOfWeek: DayOfWeek,
  current: DayKey
): boolean {
  if (dayWeekNumber < current.week_number) return true;
  if (dayWeekNumber > current.week_number) return false;
  return DAY_ORDER[dayDayOfWeek] <= DAY_ORDER[current.day_of_week];
}

/**
 * Returns which series are visible and whether each is fully accessible.
 *
 * CuarentaMás / CuarentaMás Extra: only the current month's series,
 *   restricted to the current week and day.
 *
 * Strong & Fit: cumulative — series 1…(months_elapsed-1) are fully
 *   accessible; series months_elapsed is restricted to the current week/day.
 */
export function getAccessibleSeries(
  programSlug: string,
  monthsElapsed: number
): AccessibleSeries[] {
  if (programSlug === "strong-fit") {
    return Array.from({ length: monthsElapsed }, (_, i) => ({
      series_number: i + 1,
      fully_accessible: i + 1 < monthsElapsed,
    }));
  }
  // cuarenta-mas and cuarenta-mas-extra: current series only
  return [{ series_number: monthsElapsed, fully_accessible: false }];
}

/** The series_number to query for /portal/today is always months_elapsed. */
export function getCurrentSeriesNumber(monthsElapsed: number): number {
  return monthsElapsed;
}
