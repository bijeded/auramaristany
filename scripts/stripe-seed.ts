/**
 * stripe-seed.ts — Lógica pura del respaldo en Stripe de `seed-demo.ts` (D28).
 *
 * Unos pocos clientes del seed llevan una suscripción REAL de Stripe en modo
 * test, para que cancelar y reactivar se puedan probar sobre datos sembrados.
 * El resto conserva ids sintéticos (`sub_seed_NNN`), que Stripe no conoce.
 */

export type SeedFlow = 'cancel' | 'reactivate'

/**
 * Única lista de clientes respaldados en Stripe, por correo. La lee el paso de
 * Stripe del seed y la tabla que imprime; no hay segunda copia.
 *
 * `cancel` → escenario `active` sin baja pendiente. `reactivate` → escenario
 * `grace` (baja programada, aún con acceso).
 */
export const STRIPE_BACKED: Readonly<Record<string, SeedFlow>> = {
  'gaby.torres@test.aura.mx': 'cancel',
  'paty.reyes@test.aura.mx': 'cancel',
  'adri.ortega@test.aura.mx': 'reactivate',
}

/** Metadata con la que el seed marca sus objetos, para poder borrarlos al resembrar. */
export const SEED_METADATA = { seed: 'demo' } as const

export function isSeedCustomer(customer: { metadata?: Record<string, string> | null }): boolean {
  return customer.metadata?.seed === SEED_METADATA.seed
}

export type StripeSeedParams = {
  /** `backdate_start_date`: el periodo vigente empieza donde el seed lo calcula. */
  backdateStartDate: number
  /** `billing_cycle_anchor`: el primer cobro es al final del periodo, no hoy. */
  billingCycleAnchor: number
  cancelAtPeriodEnd: boolean
  flow: SeedFlow
}

const toUnix = (d: Date) => Math.floor(d.getTime() / 1000)

/**
 * Parámetros de creación para un cliente respaldado en Stripe, o `null` si el
 * cliente se queda con ids sintéticos. Con `proration_behavior: 'none'` Stripe
 * no factura el tramo retroactivo, así que sembrar no cobra nada (design D2).
 *
 * Lanza si el periodo no empieza estrictamente antes de hoy: una fecha anterior
 * al inicio del periodo no tiene celda en la rejilla (regla 17).
 */
export function stripeSeedParams(input: {
  email: string
  periodStart: Date
  periodEnd: Date
  today: Date
}): StripeSeedParams | null {
  const flow = STRIPE_BACKED[input.email]
  if (!flow) return null
  if (input.periodStart.getTime() >= input.today.getTime()) {
    throw new Error(`El periodo de ${input.email} debe empezar antes de hoy`)
  }
  return {
    backdateStartDate: toUnix(input.periodStart),
    billingCycleAnchor: toUnix(input.periodEnd),
    cancelAtPeriodEnd: flow === 'reactivate',
    flow,
  }
}
