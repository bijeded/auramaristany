/**
 * seed-demo.ts — Siembra datos de demostración SIN tocar el catálogo de contenido.
 *
 * Ejecutar: npx tsx --env-file=.env.local scripts/seed-demo.ts
 *
 * Qué hace:
 *   - Borra usuarios de auth y TODOS los datos de usuario (perfiles, subs, invoices,
 *     progreso, mensajes, respuestas de onboarding, bajas, llamadas, avisos) y los
 *     archivos en storage (avatars, progress).
 *   - NO toca el catálogo (programs, variants, series, días, bloques, onboarding_questions,
 *     automated_messages).
 *   - Re-crea admin + 32 clientes repartidos en las 10 variantes, cubriendo TODOS los
 *     estados de suscripción expresables (los 9 del CHECK de `subscriptions.status` más
 *     los dos derivados: gracia y último mes de plazo fijo) y los 7 motivos de baja.
 *
 * Fechas: se calculan SIEMPRE relativas al día de ejecución, para que la demo no
 * envejezca. Los estados "vivos" quedan con el día de hoy dentro de su periodo
 * vigente; los "muertos" con el periodo ya cerrado.
 *
 * Resultado:
 *   - Admin: hola@auramaristany.com / 09876543
 *   - 32 clientes (contraseña 12345678, correos @test.aura.mx)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const DRY_RUN = process.argv.includes('--dry-run')

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_ROLE_KEY)) {
  console.error('Faltan variables de entorno. Usa: npx tsx --env-file=.env.local scripts/seed-demo.ts')
  process.exit(1)
}

// En `--dry-run` no se abre ninguna conexión: el cliente se construye con un
// destino inerte y nada lo llega a usar.
const supabase = createClient(
  DRY_RUN ? SUPABASE_URL || 'http://localhost' : SUPABASE_URL,
  DRY_RUN ? SERVICE_ROLE_KEY || 'dry-run' : SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const NIL_UUID = '00000000-0000-0000-0000-000000000000'
const PRICE_MXN = 999.0

/** Borra todas las filas de una tabla usando service_role (requiere filtro WHERE). */
async function deleteAll(table: string, pk = 'id') {
  const { error } = await supabase.from(table).delete().neq(pk, NIL_UUID)
  if (error) throw new Error(`Error borrando ${table}: ${error.message}`)
}

/** Vacía un bucket de storage cuyos archivos están bajo carpetas {user_id}/... */
async function emptyBucket(bucket: string) {
  const { data: folders, error } = await supabase.storage.from(bucket).list('', { limit: 1000 })
  if (error) throw new Error(`Error listando ${bucket}: ${error.message}`)
  if (!folders) return
  for (const folder of folders) {
    if (folder.id === null || folder.name === '.emptyFolderPlaceholder') {
      // Es una carpeta (id null) — listar su contenido.
      const { data: files, error: lErr } = await supabase.storage.from(bucket).list(folder.name, { limit: 1000 })
      if (lErr) throw new Error(`Error listando ${bucket}/${folder.name}: ${lErr.message}`)
      const paths = (files ?? []).map((f) => `${folder.name}/${f.name}`)
      if (paths.length) {
        const { error: rErr } = await supabase.storage.from(bucket).remove(paths)
        if (rErr) throw new Error(`Error borrando en ${bucket}: ${rErr.message}`)
      }
    } else {
      // Archivo en la raíz.
      const { error: rErr } = await supabase.storage.from(bucket).remove([folder.name])
      if (rErr) throw new Error(`Error borrando ${bucket}/${folder.name}: ${rErr.message}`)
    }
  }
}

// ── Fechas ──────────────────────────────────────────────────────────────────

/** Suma meses en UTC sin desbordar de mes (31 ene + 1 mes = 28/29 feb). */
function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

/** Medianoche UTC de hoy: el ancla de toda la aritmética de periodos. */
const TODAY = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00.000Z')

// ── Catálogo ────────────────────────────────────────────────────────────────

const VARIANT = {
  CM_PRINC_POCO: '00000000-0000-0000-0002-000000000001',
  CM_PRINC_SUF: '00000000-0000-0000-0002-000000000002',
  CM_INT_POCO: '00000000-0000-0000-0002-000000000003',
  CM_INT_SUF: '00000000-0000-0000-0002-000000000004',
  CM_AVZ_SUF: '00000000-0000-0000-0002-000000000005',
  CME_INT: '00000000-0000-0000-0002-000000000006',
  CME_AVZ: '00000000-0000-0000-0002-000000000007',
  SF_PRINC: '00000000-0000-0000-0002-000000000008',
  SF_INT: '00000000-0000-0000-0002-000000000009',
  SF_AVZ: '00000000-0000-0000-0002-000000000010',
} as const

const VARIANT_LABEL: Record<string, string> = {
  [VARIANT.CM_PRINC_POCO]: 'CuarentaMás Principiante · Poco tiempo',
  [VARIANT.CM_PRINC_SUF]: 'CuarentaMás Principiante · Tiempo suficiente',
  [VARIANT.CM_INT_POCO]: 'CuarentaMás Intermedio · Poco tiempo',
  [VARIANT.CM_INT_SUF]: 'CuarentaMás Intermedio · Tiempo suficiente',
  [VARIANT.CM_AVZ_SUF]: 'CuarentaMás Avanzado · Tiempo suficiente',
  [VARIANT.CME_INT]: 'CuarentaMás Extra Intermedio',
  [VARIANT.CME_AVZ]: 'CuarentaMás Extra Avanzado',
  [VARIANT.SF_PRINC]: 'Strong & Fit Principiante',
  [VARIANT.SF_INT]: 'Strong & Fit Intermedio',
  [VARIANT.SF_AVZ]: 'Strong & Fit Avanzado',
}

// ── Escenarios ──────────────────────────────────────────────────────────────

/**
 * Un escenario = un estado del ciclo de vida tal como lo ve la app, no sólo el
 * valor de `status`. Dos de ellos son DERIVADOS de varias columnas
 * (`deriveCancellationState`, ADR 0003/0004) y por eso no se pueden expresar
 * sólo con `status`:
 *
 *   grace       → status vivo + cancel_at_period_end (baja pedida, aún con acceso)
 *   completing  → plazo fijo en su mes 6 ya pagado: completed_at + cancel_at_period_end
 *
 * `no_subscription` cubre a quien se registró y nunca llegó al checkout: perfil
 * sin onboarding y sin fila de suscripción.
 */
type Scenario =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'paused'
  | 'incomplete'
  | 'grace'
  | 'completing'
  | 'completed'
  | 'canceled'
  | 'unpaid'
  | 'incomplete_expired'
  | 'no_subscription'

const SCENARIO_LABEL: Record<Scenario, string> = {
  active: 'Activa',
  trialing: 'Prueba',
  past_due: 'Pago atrasado',
  paused: 'Pausada',
  incomplete: 'Checkout sin confirmar',
  grace: 'Último mes (baja programada)',
  completing: 'Último mes (programa por terminar)',
  completed: 'Programa terminado',
  canceled: 'Cancelada',
  unpaid: 'Impaga (cobro agotado)',
  incomplete_expired: 'Checkout expirado',
  no_subscription: 'Registrada sin suscripción',
}

/** ¿El día de hoy cae dentro del periodo vigente de este escenario? */
const LIVE_SCENARIOS: readonly Scenario[] = ['active', 'trialing', 'past_due', 'paused', 'incomplete', 'grace', 'completing']

/** `status` que se escribe en la fila. Los derivados van sobre un status vivo. */
const SCENARIO_STATUS: Record<Exclude<Scenario, 'no_subscription'>, string> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  paused: 'paused',
  incomplete: 'incomplete',
  grace: 'active',
  completing: 'active',
  completed: 'completed',
  canceled: 'canceled',
  unpaid: 'unpaid',
  incomplete_expired: 'incomplete_expired',
}

type CancellationReason =
  | 'precio_muy_caro'
  | 'no_tengo_tiempo'
  | 'no_logre_objetivo'
  | 'no_veo_resultados'
  | 'encontre_otra_opcion'
  | 'otro'
  | 'pago_fallido'

type ClientDef = {
  name: string
  email: string
  phone: string
  variantId: string
  scenario: Scenario
  /** Meses ya cobrados/consumidos. Para CuarentaMás el máximo es 6. */
  monthsElapsed: number
  /** Día del periodo vigente en que estamos hoy (escenarios vivos) o días que
   *  lleva cerrado el periodo (escenarios muertos). Nunca 0: la aritmética de
   *  rejilla no tiene celda para una fecha anterior al inicio del periodo. */
  dayOffset: number
  profession: string
  cancellation?: { reason: CancellationReason; detail?: string; source: 'voluntary' | 'involuntary' }
}

/**
 * 32 clientes. Reglas de reparto:
 *   - 3 por variante (las 10 variantes cubiertas) + 2 casos sueltos.
 *   - CuarentaMás y CuarentaMás Extra: sólo nombres de mujer (es su público).
 *   - Strong & Fit: mujeres y hombres, todos con nombres en español.
 *   - La mayoría activas; el resto reparte los estados menos comunes.
 */
const clients: ClientDef[] = [
  // ── CuarentaMás Principiante · Poco tiempo ────────────────────────────────
  { name: 'Gabriela Torres Mendoza', email: 'gaby.torres@test.aura.mx', phone: '5215512340001', variantId: VARIANT.CM_PRINC_POCO, scenario: 'active', monthsElapsed: 2, dayOffset: 12, profession: 'Maestra de primaria' },
  { name: 'Sofía Ramírez Luna', email: 'sofia.ramirez@test.aura.mx', phone: '5215512340002', variantId: VARIANT.CM_PRINC_POCO, scenario: 'active', monthsElapsed: 1, dayOffset: 5, profession: 'Contadora' },
  { name: 'Verónica Salas Beltrán', email: 'vero.salas@test.aura.mx', phone: '5215512340003', variantId: VARIANT.CM_PRINC_POCO, scenario: 'trialing', monthsElapsed: 1, dayOffset: 3, profession: 'Estilista' },

  // ── CuarentaMás Principiante · Tiempo suficiente ──────────────────────────
  { name: 'Valentina Castro Herrera', email: 'valen.castro@test.aura.mx', phone: '5215512340004', variantId: VARIANT.CM_PRINC_SUF, scenario: 'active', monthsElapsed: 3, dayOffset: 18, profession: 'Diseñadora gráfica' },
  { name: 'Daniela Morales Vega', email: 'dani.morales@test.aura.mx', phone: '5215512340005', variantId: VARIANT.CM_PRINC_SUF, scenario: 'past_due', monthsElapsed: 4, dayOffset: 22, profession: 'Médica general' },
  { name: 'Ana Lucía Bautista Ponce', email: 'analu.bautista@test.aura.mx', phone: '5215512340006', variantId: VARIANT.CM_PRINC_SUF, scenario: 'canceled', monthsElapsed: 2, dayOffset: 26, profession: 'Recepcionista', cancellation: { reason: 'no_tengo_tiempo', source: 'voluntary' } },

  // ── CuarentaMás Intermedio · Poco tiempo ──────────────────────────────────
  { name: 'Lucía Jiménez Soto', email: 'lucia.jimenez@test.aura.mx', phone: '5215512340007', variantId: VARIANT.CM_INT_POCO, scenario: 'active', monthsElapsed: 5, dayOffset: 9, profession: 'Abogada' },
  { name: 'Regina Ávalos Trejo', email: 'regina.avalos@test.aura.mx', phone: '5215512340008', variantId: VARIANT.CM_INT_POCO, scenario: 'active', monthsElapsed: 2, dayOffset: 15, profession: 'Agente de viajes' },
  { name: 'Silvia Ochoa Barrera', email: 'silvia.ochoa@test.aura.mx', phone: '5215512340009', variantId: VARIANT.CM_INT_POCO, scenario: 'paused', monthsElapsed: 3, dayOffset: 20, profession: 'Enfermera quirúrgica' },

  // ── CuarentaMás Intermedio · Tiempo suficiente ────────────────────────────
  { name: 'Mariana López Cervantes', email: 'mariana.lopez@test.aura.mx', phone: '5215512340010', variantId: VARIANT.CM_INT_SUF, scenario: 'active', monthsElapsed: 4, dayOffset: 7, profession: 'Nutrióloga' },
  { name: 'Beatriz Cordero Lomelí', email: 'bea.cordero@test.aura.mx', phone: '5215512340011', variantId: VARIANT.CM_INT_SUF, scenario: 'completing', monthsElapsed: 6, dayOffset: 11, profession: 'Bibliotecaria' },
  { name: 'Norma Ledesma Quiroz', email: 'norma.ledesma@test.aura.mx', phone: '5215512340012', variantId: VARIANT.CM_INT_SUF, scenario: 'canceled', monthsElapsed: 3, dayOffset: 40, profession: 'Comerciante', cancellation: { reason: 'no_veo_resultados', source: 'voluntary' } },

  // ── CuarentaMás Avanzado · Tiempo suficiente ──────────────────────────────
  { name: 'Natalia Gutiérrez Ríos', email: 'natalia.gutierrez@test.aura.mx', phone: '5215512340013', variantId: VARIANT.CM_AVZ_SUF, scenario: 'completed', monthsElapsed: 6, dayOffset: 14, profession: 'Arquitecta' },
  { name: 'Paulina Escobar Nájera', email: 'pau.escobar@test.aura.mx', phone: '5215512340014', variantId: VARIANT.CM_AVZ_SUF, scenario: 'active', monthsElapsed: 2, dayOffset: 24, profession: 'Instructora de yoga' },
  { name: 'Leticia Zamora Aparicio', email: 'lety.zamora@test.aura.mx', phone: '5215512340015', variantId: VARIANT.CM_AVZ_SUF, scenario: 'active', monthsElapsed: 5, dayOffset: 6, profession: 'Notaria' },

  // ── CuarentaMás Extra Intermedio (mensual abierta) ────────────────────────
  { name: 'Carmen Flores Pacheco', email: 'carmen.flores@test.aura.mx', phone: '5215512340016', variantId: VARIANT.CME_INT, scenario: 'active', monthsElapsed: 3, dayOffset: 13, profession: 'Enfermera' },
  { name: 'Isabel Vargas Espinoza', email: 'isabel.vargas@test.aura.mx', phone: '5215512340017', variantId: VARIANT.CME_INT, scenario: 'active', monthsElapsed: 8, dayOffset: 21, profession: 'Psicóloga' },
  { name: 'Claudia Núñez Aguilar', email: 'claudia.nunez@test.aura.mx', phone: '5215512340018', variantId: VARIANT.CME_INT, scenario: 'incomplete', monthsElapsed: 1, dayOffset: 2, profession: 'Chef' },
  { name: 'Guadalupe Serrano Mata', email: 'lupita.serrano@test.aura.mx', phone: '5215512340019', variantId: VARIANT.CME_INT, scenario: 'canceled', monthsElapsed: 4, dayOffset: 55, profession: 'Trabajadora social', cancellation: { reason: 'otro', detail: 'Me mudé de ciudad y estoy reacomodando mis horarios.', source: 'voluntary' } },

  // ── CuarentaMás Extra Avanzado (mensual abierta) ──────────────────────────
  { name: 'Rosa Hernández Medina', email: 'rosa.hernandez@test.aura.mx', phone: '5215512340020', variantId: VARIANT.CME_AVZ, scenario: 'active', monthsElapsed: 12, dayOffset: 16, profession: 'Profesora universitaria' },
  { name: 'Ángeles Rivas Toledo', email: 'angeles.rivas@test.aura.mx', phone: '5215512340021', variantId: VARIANT.CME_AVZ, scenario: 'active', monthsElapsed: 2, dayOffset: 4, profession: 'Fotógrafa' },
  { name: 'Teresa Cabrera Loera', email: 'tere.cabrera@test.aura.mx', phone: '5215512340022', variantId: VARIANT.CME_AVZ, scenario: 'canceled', monthsElapsed: 5, dayOffset: 33, profession: 'Empresaria', cancellation: { reason: 'encontre_otra_opcion', detail: 'Entré a un gimnasio cerca de mi casa con entrenadora.', source: 'voluntary' } },

  // ── Strong & Fit Principiante (mixto) ─────────────────────────────────────
  { name: 'Patricia Reyes Sandoval', email: 'paty.reyes@test.aura.mx', phone: '5215512340023', variantId: VARIANT.SF_PRINC, scenario: 'active', monthsElapsed: 2, dayOffset: 10, profession: 'Fisioterapeuta' },
  { name: 'Roberto Sánchez Molina', email: 'roberto.sanchez@test.aura.mx', phone: '5215512340024', variantId: VARIANT.SF_PRINC, scenario: 'active', monthsElapsed: 6, dayOffset: 19, profession: 'Contador' },
  { name: 'Javier Alcántara Ruelas', email: 'javier.alcantara@test.aura.mx', phone: '5215512340025', variantId: VARIANT.SF_PRINC, scenario: 'incomplete_expired', monthsElapsed: 1, dayOffset: 48, profession: 'Chofer' },

  // ── Strong & Fit Intermedio (mixto) ───────────────────────────────────────
  { name: 'Alejandra Domínguez Cruz', email: 'ale.dominguez@test.aura.mx', phone: '5215512340026', variantId: VARIANT.SF_INT, scenario: 'active', monthsElapsed: 3, dayOffset: 8, profession: 'Ama de casa' },
  { name: 'Andrés Vázquez Estrada', email: 'andres.vazquez@test.aura.mx', phone: '5215512340027', variantId: VARIANT.SF_INT, scenario: 'active', monthsElapsed: 9, dayOffset: 23, profession: 'Ingeniero mecánico' },
  { name: 'Ricardo Peralta Ibáñez', email: 'ricardo.peralta@test.aura.mx', phone: '5215512340028', variantId: VARIANT.SF_INT, scenario: 'unpaid', monthsElapsed: 4, dayOffset: 12, profession: 'Vendedor de seguros', cancellation: { reason: 'pago_fallido', source: 'involuntary' } },

  // ── Strong & Fit Avanzado (mixto) ─────────────────────────────────────────
  { name: 'Adriana Ortega Salazar', email: 'adri.ortega@test.aura.mx', phone: '5215512340029', variantId: VARIANT.SF_AVZ, scenario: 'grace', monthsElapsed: 7, dayOffset: 17, profession: 'Vendedora', cancellation: { reason: 'no_logre_objetivo', source: 'voluntary' } },
  { name: 'Miguel Ángel Ruiz Téllez', email: 'miguel.ruiz@test.aura.mx', phone: '5215512340030', variantId: VARIANT.SF_AVZ, scenario: 'active', monthsElapsed: 14, dayOffset: 25, profession: 'Médico especialista' },
  { name: 'Mónica Ibarra Contreras', email: 'monica.ibarra@test.aura.mx', phone: '5215512340031', variantId: VARIANT.SF_AVZ, scenario: 'canceled', monthsElapsed: 6, dayOffset: 21, profession: 'Ingeniera civil', cancellation: { reason: 'precio_muy_caro', source: 'voluntary' } },

  // ── Registrada sin suscripción (nunca llegó al checkout) ──────────────────
  { name: 'Marisol Aguirre Zepeda', email: 'marisol.aguirre@test.aura.mx', phone: '5215512340032', variantId: VARIANT.CM_PRINC_POCO, scenario: 'no_subscription', monthsElapsed: 0, dayOffset: 0, profession: 'Repostera' },
]

/** Periodo vigente + alta, derivados del escenario y del día de ejecución. */
function computeDates(c: ClientDef) {
  const live = LIVE_SCENARIOS.includes(c.scenario)
  const periodStart = live
    ? addDays(TODAY, -c.dayOffset)
    : addMonths(addDays(TODAY, -c.dayOffset), -1)
  const periodEnd = addMonths(periodStart, 1)
  const enrollment = addMonths(periodStart, -(Math.max(c.monthsElapsed, 1) - 1))
  return { periodStart, periodEnd, enrollment }
}

/** Tabla en Markdown, lista para copiar a la demo. */
function printTable() {
  console.log('| # | Cliente | Correo | Variante | Estado | Mes | Alta | Periodo vigente | Motivo de baja |')
  console.log('|---|---------|--------|----------|--------|-----|------|-----------------|----------------|')
  clients.forEach((c, i) => {
    const day = (d: Date) => d.toISOString().split('T')[0]
    if (c.scenario === 'no_subscription') {
      console.log(`| ${i + 1} | ${c.name} | ${c.email} | — | ${SCENARIO_LABEL[c.scenario]} | — | — | — | — |`)
      return
    }
    const { periodStart, periodEnd, enrollment } = computeDates(c)
    const reason = c.cancellation ? c.cancellation.reason : '—'
    console.log(
      `| ${i + 1} | ${c.name} | ${c.email} | ${VARIANT_LABEL[c.variantId]} | ${SCENARIO_LABEL[c.scenario]} | ${c.monthsElapsed} | ${day(enrollment)} | ${day(periodStart)} → ${day(periodEnd)} | ${reason} |`
    )
  })
  console.log()
}

async function main() {
  console.log('\n════════════════════════════════════════')
  console.log('  SEED DEMO — AURA MARISTANY (aditivo)')
  console.log('════════════════════════════════════════\n')
  console.log(`  Fecha ancla: ${TODAY.toISOString().split('T')[0]}\n`)

  // 1. LIMPIAR SOLO TABLAS DE DATOS DE USUARIO (hijos → padres). NO catálogo.
  //
  //    ⚠ Las tablas van ANTES de auth, no después. `messages.sender_id` apunta a
  //    profiles SIN `on delete cascade` (001 lo creó así y 007 cubrió todas las
  //    demás FKs menos ésa), así que borrar el auth.user del admin falla en
  //    cuanto exista un solo mensaje enviado: la cascada a `profiles` choca con
  //    la FK. Vaciando las tablas primero no queda nada que la retenga.
  console.log('1/6  Limpiando datos de usuario...')
  const userTables = [
    'progress_photos',
    'body_metrics',
    'progress_logs',
    'subscription_events',
    'invoices',
    'message_recipients',
    'messages',
    'onboarding_responses',
    'cancellation_surveys',
    'bookings',
    'automated_notices',
    'subscriptions',
    'profiles',
  ]
  for (const table of userTables) {
    await deleteAll(table)
  }
  console.log('     Tablas de usuario limpias.')

  // 1b. LIMPIAR ARCHIVOS DE USUARIO EN STORAGE
  console.log('1b/6 Limpiando storage (avatars, progress)...')
  await emptyBucket('avatars')
  await emptyBucket('progress')
  console.log('     Storage limpio.')

  // 2. ELIMINAR USUARIOS DE AUTH
  //    El error de `deleteUser` se comprueba: tragárselo convertía un fallo de FK
  //    aquí en un `email_exists` incomprensible 300 líneas más abajo, al crear el
  //    admin que en realidad nunca se había borrado.
  console.log('2/6  Eliminando usuarios de auth...')
  let totalDeleted = 0
  while (true) {
    // Siempre página 1: cada vuelta borra lo que lee, así que paginar hacia
    // adelante sobre una lista que se encoge se saltaría usuarios.
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 })
    if (error) throw error
    if (!data.users.length) break
    for (const u of data.users) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id)
      if (delErr) throw new Error(`No se pudo borrar el usuario ${u.email}: ${delErr.message}`)
      totalDeleted++
    }
  }
  console.log(`     ${totalDeleted} usuario(s) eliminado(s).`)

  // 3. PREGUNTA DE ONBOARDING (existente, no se crea ni borra)
  console.log('3/6  Buscando pregunta de onboarding activa...')
  const { data: qRow } = await supabase
    .from('onboarding_questions')
    .select('id')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  const questionId: string | null = qRow?.id ?? null
  console.log(questionId ? `     Pregunta activa: ${questionId}` : '     Sin pregunta activa: se omiten respuestas.')

  // 4. ADMIN
  console.log('4/6  Creando admin...')
  const { data: adminAuth, error: adminAuthErr } = await supabase.auth.admin.createUser({
    email: 'hola@auramaristany.com',
    password: '09876543',
    email_confirm: true,
    user_metadata: { full_name: 'Aura Maristany' },
  })
  if (adminAuthErr) throw adminAuthErr
  const adminId = adminAuth.user.id
  const { error: adminProfileErr } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', adminId)
  if (adminProfileErr) throw adminProfileErr
  console.log(`     Admin ID: ${adminId}`)

  // 5. CLIENTES
  console.log(`5/6  Creando ${clients.length} clientes...`)

  for (let i = 0; i < clients.length; i++) {
    const c = clients[i]
    const n = String(i + 1).padStart(2, '0')
    const seq = String(i + 1).padStart(3, '0')
    const cusId = `cus_seed_${seq}`
    const subId = `sub_seed_${seq}`
    process.stdout.write(`     [${n}/${clients.length}] ${c.name}...`)

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: c.email,
      password: '12345678',
      email_confirm: true,
      user_metadata: { full_name: c.name, phone: c.phone },
    })
    if (authErr) throw authErr
    const userId = authUser.user.id

    // El trigger handle_new_user ya copió full_name y phone (migración 008).
    const { error: profErr } = await supabase
      .from('profiles')
      .update({
        phone: c.phone,
        onboarding_completed: c.scenario !== 'no_subscription',
        stripe_customer_id: c.scenario === 'no_subscription' ? null : cusId,
      })
      .eq('id', userId)
    if (profErr) throw profErr

    if (c.scenario === 'no_subscription') {
      process.stdout.write(' ✓ (sin suscripción)\n')
      continue
    }

    const { periodStart, periodEnd, enrollment } = computeDates(c)

    // ADR 0003/0004 — `completed_at` se sella cuando la completion queda
    // PROGRAMADA, y sólo tiene sentido junto a `cancel_at_period_end`. Una marca
    // sin cancelación real le prometería a la cliente que no se le cobrará.
    const completionScheduled = c.scenario === 'completing' || c.scenario === 'completed'
    const cancelAtPeriodEnd = completionScheduled || c.scenario === 'grace'

    const { data: subRow, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        profile_id: userId,
        program_variant_id: c.variantId,
        stripe_subscription_id: subId,
        stripe_customer_id: cusId,
        status: SCENARIO_STATUS[c.scenario],
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: cancelAtPeriodEnd,
        months_elapsed: c.monthsElapsed,
        enrollment_date: enrollment.toISOString().split('T')[0],
        completed_at: completionScheduled ? periodStart.toISOString() : null,
      })
      .select('id')
      .single()
    if (subErr) throw subErr

    // Invoices: un cobro por mes consumido. El último refleja el estado real del
    // cobro (`open` en dunning, `uncollectible` cuando Stripe se rindió).
    // `incomplete*` y `trialing` no han generado ningún cobro pagado.
    const paidMonths = ['incomplete', 'incomplete_expired', 'trialing'].includes(c.scenario)
      ? 0
      : c.monthsElapsed
    const invoices = Array.from({ length: paidMonths }, (_, m) => {
      const isLast = m === paidMonths - 1
      const status = isLast && c.scenario === 'past_due' ? 'open' : isLast && c.scenario === 'unpaid' ? 'uncollectible' : 'paid'
      return {
        subscription_id: subRow.id,
        stripe_invoice_id: `in_seed_${seq}_m${m + 1}`,
        amount_paid: status === 'paid' ? PRICE_MXN : 0,
        currency: 'mxn',
        status,
        invoice_date: addMonths(enrollment, m).toISOString(),
      }
    })
    if (invoices.length) {
      const { error: invErr } = await supabase.from('invoices').insert(invoices)
      if (invErr) throw invErr
    }

    if (c.cancellation) {
      const { error: csErr } = await supabase.from('cancellation_surveys').insert({
        profile_id: userId,
        subscription_id: subRow.id,
        reason: c.cancellation.reason,
        detail: c.cancellation.detail ?? null,
        source: c.cancellation.source,
        created_at: addDays(periodEnd, -3).toISOString(),
      })
      if (csErr) throw csErr
    }

    if (questionId) {
      const { error: orErr } = await supabase.from('onboarding_responses').insert({
        profile_id: userId,
        responses: { [questionId]: c.profession },
        completed_at: enrollment.toISOString(),
      })
      if (orErr) throw orErr
    }

    process.stdout.write(' ✓\n')
  }

  // 6. RESUMEN
  console.log('\n6/6  Verificando conteos...')
  const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: subCount } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true })
  const { count: invCount } = await supabase.from('invoices').select('*', { count: 'exact', head: true })
  const { count: csCount } = await supabase.from('cancellation_surveys').select('*', { count: 'exact', head: true })

  console.log(`\n════════════════════════════════════════`)
  console.log('  SEED COMPLETADO')
  console.log('════════════════════════════════════════')
  console.log(`  Perfiles:      ${profileCount} (1 admin + ${clients.length} clientes)`)
  console.log(`  Suscripciones: ${subCount}`)
  console.log(`  Invoices:      ${invCount}`)
  console.log(`  Bajas:         ${csCount}`)
  console.log()
  console.log('  Admin:    hola@auramaristany.com  /  09876543')
  console.log('  Clientes: ver tabla abajo         /  12345678')
  console.log('════════════════════════════════════════\n')

  printTable()
}

// `--dry-run` sólo imprime la tabla: no toca auth, ni la base, ni storage.
if (DRY_RUN) {
  console.log(`\nDRY RUN — fecha ancla ${TODAY.toISOString().split('T')[0]}\n`)
  printTable()
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ Error:', err)
  process.exit(1)
})
