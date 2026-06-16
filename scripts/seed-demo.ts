/**
 * seed-demo.ts — Siembra datos de demostración SIN tocar el catálogo de contenido.
 *
 * Ejecutar: npx tsx --env-file=.env.local scripts/seed-demo.ts
 *
 * Qué hace:
 *   - Borra usuarios de auth y TODOS los datos de usuario (perfiles, subs, invoices,
 *     progreso, mensajes, respuestas de onboarding) y los archivos en storage (avatars, progress).
 *   - NO toca el catálogo (programs, variants, series, días, bloques, onboarding_questions).
 *   - Re-crea admin + 20 clientes (17 mujeres + 3 hombres) con subs/invoices/respuestas.
 *
 * Resultado:
 *   - Admin: hola@auramaristany.com / 09876543
 *   - 20 clientes (contraseña 12345678): 15 activos, 3 past_due, 2 cancelados
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan variables de entorno. Usa: npx tsx --env-file=.env.local scripts/seed-demo.ts')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

/** Borra todas las filas de una tabla usando service_role (requiere filtro WHERE). */
async function deleteAll(table: string) {
  const { error } = await supabase.from(table).delete().neq('id', NIL_UUID)
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

async function main() {
  console.log('\n════════════════════════════════════════')
  console.log('  SEED DEMO — AURA MARISTANY (aditivo)')
  console.log('════════════════════════════════════════\n')

  // 1. ELIMINAR USUARIOS DE AUTH
  console.log('1/6  Eliminando usuarios de auth...')
  let page = 1
  let totalDeleted = 0
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    if (!data.users.length) break
    for (const u of data.users) {
      await supabase.auth.admin.deleteUser(u.id)
      totalDeleted++
    }
    if (data.users.length < 100) break
    page++
  }
  console.log(`     ${totalDeleted} usuario(s) eliminado(s).`)

  // 2. LIMPIAR SOLO TABLAS DE DATOS DE USUARIO (hijos → padres). NO catálogo.
  console.log('2/6  Limpiando datos de usuario...')
  const userTables = [
    'progress_photos',
    'body_metrics',
    'progress_logs',
    'subscription_events',
    'invoices',
    'message_recipients',
    'messages',
    'onboarding_responses',
    'subscriptions',
    'profiles',
  ]
  for (const table of userTables) {
    await deleteAll(table)
  }
  console.log('     Tablas de usuario limpias.')

  // 2b. LIMPIAR ARCHIVOS DE USUARIO EN STORAGE
  console.log('2b/6 Limpiando storage (avatars, progress)...')
  await emptyBucket('avatars')
  await emptyBucket('progress')
  console.log('     Storage limpio.')

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

  // 5. 20 CLIENTES
  console.log('5/6  Creando 20 clientes...')

  type ClientDef = {
    name: string
    email: string
    variantId: string
    status: 'active' | 'past_due' | 'canceled'
    monthsElapsed: number
    profession: string
    cusId: string
    subId: string
  }

  const VARIANT = {
    CM_PRINC_POCO: '00000000-0000-0000-0002-000000000001',
    CM_PRINC_SUF:  '00000000-0000-0000-0002-000000000002',
    CM_INT_POCO:   '00000000-0000-0000-0002-000000000003',
    CM_INT_SUF:    '00000000-0000-0000-0002-000000000004',
    CM_AVZ_SUF:    '00000000-0000-0000-0002-000000000005',
    CME_INT:       '00000000-0000-0000-0002-000000000006',
    CME_AVZ:       '00000000-0000-0000-0002-000000000007',
    SF_PRINC:      '00000000-0000-0000-0002-000000000008',
    SF_INT:        '00000000-0000-0000-0002-000000000009',
    SF_AVZ:        '00000000-0000-0000-0002-000000000010',
  }

  const clients: ClientDef[] = [
    { name: 'Gabriela Torres Mendoza',    email: 'gaby.torres@test.aura.mx',      variantId: VARIANT.CM_PRINC_POCO, status: 'active',   monthsElapsed: 2, profession: 'Maestra de primaria',         cusId: 'cus_seed_001', subId: 'sub_seed_001' },
    { name: 'Sofía Ramírez Luna',         email: 'sofia.ramirez@test.aura.mx',    variantId: VARIANT.CM_PRINC_SUF,  status: 'active',   monthsElapsed: 1, profession: 'Contadora',                   cusId: 'cus_seed_002', subId: 'sub_seed_002' },
    { name: 'Valentina Castro Herrera',   email: 'valen.castro@test.aura.mx',     variantId: VARIANT.CM_PRINC_POCO, status: 'active',   monthsElapsed: 4, profession: 'Diseñadora gráfica',          cusId: 'cus_seed_003', subId: 'sub_seed_003' },
    { name: 'Daniela Morales Vega',       email: 'dani.morales@test.aura.mx',     variantId: VARIANT.CM_PRINC_SUF,  status: 'past_due', monthsElapsed: 3, profession: 'Médica general',              cusId: 'cus_seed_004', subId: 'sub_seed_004' },
    { name: 'Lucía Jiménez Soto',         email: 'lucia.jimenez@test.aura.mx',    variantId: VARIANT.CM_INT_POCO,   status: 'active',   monthsElapsed: 2, profession: 'Abogada',                     cusId: 'cus_seed_005', subId: 'sub_seed_005' },
    { name: 'Mariana López Cervantes',    email: 'mariana.lopez@test.aura.mx',    variantId: VARIANT.CM_INT_SUF,    status: 'active',   monthsElapsed: 5, profession: 'Nutrióloga',                  cusId: 'cus_seed_006', subId: 'sub_seed_006' },
    { name: 'Natalia Gutiérrez Ríos',     email: 'natalia.gutierrez@test.aura.mx', variantId: VARIANT.CM_AVZ_SUF,   status: 'active',   monthsElapsed: 1, profession: 'Arquitecta',                  cusId: 'cus_seed_007', subId: 'sub_seed_007' },
    { name: 'Carmen Flores Pacheco',      email: 'carmen.flores@test.aura.mx',    variantId: VARIANT.CME_INT,       status: 'active',   monthsElapsed: 3, profession: 'Enfermera',                   cusId: 'cus_seed_008', subId: 'sub_seed_008' },
    { name: 'Isabel Vargas Espinoza',     email: 'isabel.vargas@test.aura.mx',    variantId: VARIANT.CME_INT,       status: 'active',   monthsElapsed: 1, profession: 'Psicóloga',                   cusId: 'cus_seed_009', subId: 'sub_seed_009' },
    { name: 'Claudia Núñez Aguilar',      email: 'claudia.nunez@test.aura.mx',    variantId: VARIANT.CME_INT,       status: 'past_due', monthsElapsed: 2, profession: 'Chef',                        cusId: 'cus_seed_010', subId: 'sub_seed_010' },
    { name: 'Rosa Hernández Medina',      email: 'rosa.hernandez@test.aura.mx',   variantId: VARIANT.CME_AVZ,       status: 'active',   monthsElapsed: 4, profession: 'Profesora universitaria',     cusId: 'cus_seed_011', subId: 'sub_seed_011' },
    { name: 'Patricia Reyes Sandoval',    email: 'paty.reyes@test.aura.mx',       variantId: VARIANT.SF_PRINC,      status: 'active',   monthsElapsed: 2, profession: 'Fisioterapeuta',              cusId: 'cus_seed_012', subId: 'sub_seed_012' },
    { name: 'Elena Martínez Fuentes',     email: 'elena.martinez@test.aura.mx',   variantId: VARIANT.SF_PRINC,      status: 'active',   monthsElapsed: 5, profession: 'Administradora de empresas',  cusId: 'cus_seed_013', subId: 'sub_seed_013' },
    { name: 'Alejandra Domínguez Cruz',   email: 'ale.dominguez@test.aura.mx',    variantId: VARIANT.SF_INT,        status: 'active',   monthsElapsed: 3, profession: 'Ama de casa',                 cusId: 'cus_seed_014', subId: 'sub_seed_014' },
    { name: 'Fernanda Peña Villanueva',   email: 'fer.pena@test.aura.mx',         variantId: VARIANT.SF_INT,        status: 'active',   monthsElapsed: 1, profession: 'Periodista',                  cusId: 'cus_seed_015', subId: 'sub_seed_015' },
    { name: 'Adriana Ortega Salazar',     email: 'adri.ortega@test.aura.mx',      variantId: VARIANT.SF_AVZ,        status: 'active',   monthsElapsed: 6, profession: 'Vendedora',                   cusId: 'cus_seed_016', subId: 'sub_seed_016' },
    { name: 'Mónica Ibarra Contreras',    email: 'monica.ibarra@test.aura.mx',    variantId: VARIANT.SF_AVZ,        status: 'canceled', monthsElapsed: 2, profession: 'Ingeniera civil',             cusId: 'cus_seed_017', subId: 'sub_seed_017' },
    { name: 'Roberto Sánchez Molina',     email: 'roberto.sanchez@test.aura.mx',  variantId: VARIANT.SF_PRINC,      status: 'active',   monthsElapsed: 3, profession: 'Contador',                    cusId: 'cus_seed_018', subId: 'sub_seed_018' },
    { name: 'Andrés Vázquez Estrada',     email: 'andres.vazquez@test.aura.mx',   variantId: VARIANT.SF_INT,        status: 'past_due', monthsElapsed: 4, profession: 'Ingeniero mecánico',          cusId: 'cus_seed_019', subId: 'sub_seed_019' },
    { name: 'Miguel Ángel Ruiz Téllez',   email: 'miguel.ruiz@test.aura.mx',      variantId: VARIANT.SF_AVZ,        status: 'canceled', monthsElapsed: 1, profession: 'Médico especialista',         cusId: 'cus_seed_020', subId: 'sub_seed_020' },
  ]

  for (let i = 0; i < clients.length; i++) {
    const c = clients[i]
    process.stdout.write(`     [${String(i + 1).padStart(2, '0')}/20] ${c.name}...`)

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: c.email,
      password: '12345678',
      email_confirm: true,
      user_metadata: { full_name: c.name },
    })
    if (authErr) throw authErr
    const userId = authUser.user.id

    await supabase.from('profiles').update({
      onboarding_completed: true,
      stripe_customer_id: c.cusId,
    }).eq('id', userId)

    let periodStart: string
    let periodEnd: string
    if (c.status === 'active') {
      periodStart = '2026-06-01T00:00:00.000Z'
      periodEnd   = '2026-07-01T00:00:00.000Z'
    } else if (c.status === 'past_due') {
      periodStart = '2026-05-10T00:00:00.000Z'
      periodEnd   = '2026-06-09T00:00:00.000Z'
    } else {
      periodStart = '2026-04-15T00:00:00.000Z'
      periodEnd   = '2026-05-15T00:00:00.000Z'
    }

    const enrollmentDate = new Date(periodStart)
    enrollmentDate.setUTCMonth(enrollmentDate.getUTCMonth() - (c.monthsElapsed - 1))
    const enrollmentStr = enrollmentDate.toISOString().split('T')[0]

    const { data: subRow, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        profile_id: userId,
        program_variant_id: c.variantId,
        stripe_subscription_id: c.subId,
        stripe_customer_id: c.cusId,
        status: c.status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: c.status === 'canceled',
        months_elapsed: c.monthsElapsed,
        enrollment_date: enrollmentStr,
      })
      .select('id')
      .single()
    if (subErr) throw subErr

    const invoices = Array.from({ length: c.monthsElapsed }, (_, m) => {
      const invDate = new Date(enrollmentDate)
      invDate.setUTCMonth(invDate.getUTCMonth() + m)
      return {
        subscription_id: subRow.id,
        stripe_invoice_id: `in_seed_${c.cusId.replace('cus_seed_', '')}_m${m + 1}`,
        amount_paid: 999.00,
        currency: 'mxn',
        status: 'paid',
        invoice_date: invDate.toISOString(),
      }
    })
    await supabase.from('invoices').insert(invoices)

    if (questionId) {
      await supabase.from('onboarding_responses').insert({
        profile_id: userId,
        responses: { [questionId]: c.profession },
        completed_at: new Date().toISOString(),
      })
    }

    process.stdout.write(' ✓\n')
  }

  // 6. RESUMEN
  console.log('\n6/6  Verificando conteos...')
  const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: subCount } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true })
  const { count: invCount } = await supabase.from('invoices').select('*', { count: 'exact', head: true })

  console.log(`\n════════════════════════════════════════`)
  console.log('  SEED COMPLETADO')
  console.log('════════════════════════════════════════')
  console.log(`  Perfiles:      ${profileCount} (1 admin + 20 clientes)`)
  console.log(`  Suscripciones: ${subCount}`)
  console.log(`  Invoices:      ${invCount}`)
  console.log()
  console.log('  Admin:    hola@auramaristany.com  /  09876543')
  console.log('  Clientes: ver emails arriba       /  12345678')
  console.log('════════════════════════════════════════\n')
}

main().catch((err) => {
  console.error('\n❌ Error:', err)
  process.exit(1)
})
