# Fase 6 Ops — Demo en línea (A2/A3/A4-parcial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar un demo en línea funcional en `app.auramaristany.com` (Vercel Production + Supabase + Stripe test), con datos simulados, dejando el seed de demo seguro (sin secretos) y aditivo (sin borrar contenido).

**Architecture:** Una sola tarea de código (reescribir `scripts/seed-demo.ts`), una de verificación local, y luego un runbook de configuración en dashboards (Resend, Supabase Auth, Vercel, Stripe) ejecutado por Francisco con instrucciones exactas. Sin migraciones nuevas.

**Tech Stack:** Next.js 14 App Router, Supabase (`@supabase/supabase-js`, service_role), Stripe (test mode), Resend SMTP, Vercel, TypeScript, tsx.

**Spec:** `docs/superpowers/specs/2026-06-16-fase6-ops-demo-deploy-design.md`

---

## Estructura de archivos

- **Modificar:** `scripts/seed-demo.ts` — quitar dependencia del Management API (secreto + caducidad), hacer los borrados con `service_role`, volverlo aditivo (no tocar catálogo), limpiar también storage de usuario.
- **Sin cambios de código:** todo lo demás (handlers de Stripe, email, webhook, cron ya están implementados). El resto del plan es configuración.

---

## Task 1: Reescribir `scripts/seed-demo.ts` (seguro + aditivo + storage)

**Files:**
- Modify: `scripts/seed-demo.ts` (reemplazo completo)

**Contexto que el ejecutor debe conocer:**
- Hoy el script usa un token de Supabase Management API **hardcodeado** (línea 17) solo para correr `DELETE` por SQL. Ese token caduca en ~6 días y es un secreto. Lo eliminamos: los `DELETE` se harán con `supabase.from(table).delete()` usando el `service_role` (que ignora RLS).
- Todas las tablas de datos de usuario tienen `id uuid primary key`, así que el patrón de borrado total es `.delete().neq('id', '00000000-0000-0000-0000-000000000000')`.
- El script **NO** debe tocar tablas de catálogo (`programs`, `program_variants`, `program_variant_prerequisites`, `program_series`, `program_days`, `program_*_blocks`, `variant_series_map`, `onboarding_questions`). Esas ya existen y contienen el contenido real.
- Las variantes ya existen en la DB con sus `stripe_price_id` de test; el seed solo referencia sus IDs (`00000000-0000-0000-0002-00000000000X`) al crear suscripciones.
- Los archivos de usuario viven bajo `{user_id}/...` en los buckets `avatars` (fotos de perfil) y `progress` (fotos de avance). Hay que vaciarlos.
- La pregunta de onboarding ya no se crea ni se borra: se **busca una activa existente**; si no hay, se omiten las respuestas.

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplaza todo el contenido de `scripts/seed-demo.ts` por:

```ts
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
```

- [ ] **Step 2: Verificar que no quedó ningún secreto ni referencia al Management API**

Run: `grep -nE "sbp_|MGMT_TOKEN|PROJECT_REF|api.supabase.com" scripts/seed-demo.ts`
Expected: sin resultados (exit code 1, ninguna línea impresa).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-demo.ts
git commit -m "fix(seed): seed-demo aditivo sin Management API ni secretos; limpia storage

- Elimina el token de Management API hardcodeado (secreto + caduca en días)
- Borrados vía service_role (.delete().neq) en vez de SQL por Management API
- No toca el catálogo (programs/variants/series/días/bloques/onboarding_questions)
- Busca una pregunta de onboarding activa en vez de crear/borrar
- Vacía los buckets avatars y progress

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Verificación local + correr el seed

**Files:** ninguno (verificación).

- [ ] **Step 1: Build de producción**

Run: `npm run build`
Expected: build verde, sin errores de tipos ni de compilación.

- [ ] **Step 2: Tests**

Run: `npx vitest run`
Expected: 252 tests passing.

- [ ] **Step 3: Confirmar que `.env.local` no contiene `DEV_DATE` que pueda filtrarse a prod**

Run: `grep -n "DEV_DATE" .env.local`
Expected: si aparece, recordar NO copiar esa variable a Vercel (solo es de desarrollo). No es un error en local.

- [ ] **Step 4: Correr el seed contra Supabase**

Run: `npx tsx --env-file=.env.local scripts/seed-demo.ts`
Expected: termina con "SEED COMPLETADO", Perfiles: 21, Suscripciones: 20, Invoices > 0. El contenido de programas/series **se conserva** (verificar después en la app que `/admin/content` sigue mostrando series y días).

- [ ] **Step 5: Verificar que el contenido sobrevivió**

Run: `npx tsx --env-file=.env.local -e "import('@supabase/supabase-js').then(async ({createClient})=>{const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const {count}=await s.from('program_series').select('*',{count:'exact',head:true});console.log('program_series:',count)})"`
Expected: `program_series:` con un número > 0 (el contenido NO se borró).

---

## Task 3: A2 — Resend + confirmación de email (runbook, ejecuta Francisco)

**Estos pasos son en dashboards externos. Claude entrega cada valor/instrucción; Francisco ejecuta.**

- [ ] **Step 1: Verificar dominio en Resend**
  - Resend → Domains → Add Domain → `auramaristany.com`.
  - Copiar los registros DNS que genere (SPF/TXT, DKIM/CNAMEs, DMARC) al proveedor DNS del dominio.
  - Esperar a que Resend marque el dominio como **Verified**.

- [ ] **Step 2: Crear API key**
  - Resend → API Keys → Create → guardar el valor → será `RESEND_API_KEY`.

- [ ] **Step 3: Definir el remitente**
  - `RESEND_FROM_EMAIL = no-reply@auramaristany.com`.

- [ ] **Step 4: Configurar SMTP en Supabase Auth**
  - Supabase → Project `bgvxaagfnzvzamtxqbkg` → Authentication → Emails / SMTP Settings → Enable Custom SMTP.
  - Host: `smtp.resend.com`, Port: `465` (SSL) o `587` (STARTTLS), Username: `resend`, Password: el `RESEND_API_KEY`.
  - Sender email: `no-reply@auramaristany.com`, Sender name: `Aura Maristany`.

- [ ] **Step 5: Activar confirmación de email**
  - Supabase → Authentication → Sign In / Providers → Email → activar **Confirm email**.

- [ ] **Step 6: Verificación**
  - Enviarse un email de prueba desde Resend o registrar una cuenta real (no demo) y confirmar que llega el correo de confirmación.

---

## Task 4: A3 — Deploy a Vercel (runbook, ejecuta Francisco)

- [ ] **Step 1: Generar `CRON_SECRET`**

Run (Claude lo ejecuta y entrega el valor): `openssl rand -hex 32`

- [ ] **Step 2: Conectar el repo en Vercel**
  - Vercel → Add New → Project → importar el repo de Aura.
  - Production Branch: `main`. Framework: Next.js (autodetectado).
  - Confirmar que `app.auramaristany.com` está asignado al proyecto (ya conectado).

- [ ] **Step 3: Setear env vars (Production), Stripe en TEST**

En Vercel → Settings → Environment Variables (Production):
```
NEXT_PUBLIC_SUPABASE_URL=<de .env.local>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<de .env.local>
SUPABASE_SERVICE_ROLE_KEY=<de .env.local>
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
RESEND_API_KEY=re_...                       (de Task 3)
RESEND_FROM_EMAIL=no-reply@auramaristany.com
NEXT_PUBLIC_APP_URL=https://app.auramaristany.com
NEXT_PUBLIC_AURA_WHATSAPP=<número real de Aura>
CRON_SECRET=<valor del Step 1>
```
NO agregar `DEV_DATE` ni `SUPABASE_MGMT_TOKEN`. `STRIPE_WEBHOOK_SECRET` se agrega en el Step 5.

- [ ] **Step 4: Primer deploy**
  - Disparar deploy de `main` (push o botón Deploy).
  - Esperar build verde. Abrir `https://app.auramaristany.com` y confirmar que carga la landing.

- [ ] **Step 5: Registrar webhook de Stripe (TEST) y copiar el secret**
  - Stripe (modo **Test**) → Developers → Webhooks → Add endpoint.
  - URL: `https://app.auramaristany.com/api/webhooks/stripe`.
  - Eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`.
  - Copiar el **Signing secret** (`whsec_...`) → agregarlo en Vercel como `STRIPE_WEBHOOK_SECRET` (Production) → re-deploy para que tome la variable.

---

## Task 5: A4-parcial — Smoke test E2E en producción (runbook, ejecuta Francisco)

- [ ] **Step 1: Login admin demo**
  - `https://app.auramaristany.com` → login `hola@auramaristany.com` / `09876543`.
  - Verificar `/admin/dashboard`, `/admin/clients` (20 clientes), `/admin/payments`, `/admin/content/[program]` (series y días presentes).

- [ ] **Step 2: Login cliente demo**
  - Logout → login `gaby.torres@test.aura.mx` / `12345678`.
  - Verificar `/portal/today` con contenido del día y `/portal/settings`.

- [ ] **Step 3: Flujo de registro real → checkout test**
  - Logout → `/auth/register` con un email real propio + teléfono.
  - Recibir y abrir el correo de confirmación (valida Task 3).
  - Completar onboarding → elegir plan → checkout con tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura / CVC).
  - Confirmar que el webhook crea la suscripción y el portal queda activo.
  - Verificar en `/admin/payments` que aparece el invoice del nuevo cliente.

- [ ] **Step 4: Verificar el cron (opcional)**
  - Vercel → el cron `purge-messages` (3am) está definido en `vercel.json`; confirmar que aparece en Vercel → Settings → Cron Jobs y usa `CRON_SECRET`.

---

## Notas para la etapa de lanzamiento (NO en este plan)

- **A4-live:** crear Products/Prices en Stripe live con precios reales → actualizar `program_variants` (`stripe_price_id`, `price_mxn`) → cambiar keys test→live en Vercel → re-registrar webhook en Stripe live → copiar nuevo `STRIPE_WEBHOOK_SECRET`.
- **Limpieza pre-lanzamiento:** eliminar datos de clientes (no admin, no programas/series). El seed reescrito sirve de base, pero para lanzamiento real se borra sin re-crear los 20 demo.
- **UI de planes/precios:** decidir con Aura si se mantiene script+SQL o se construye UI.

---

## Self-Review

- **Cobertura del spec:** Foco 1 (secreto/caducidad) → Task 1. Foco 2 (seed aditivo + storage) → Task 1. A2 → Task 3. A3 → Task 4. A4-parcial + smoke → Task 5. Workflow Vercel `main`→Production → Task 4 Step 2. Trabajo futuro → sección final. ✓
- **Sin placeholders:** el código del seed está completo; los pasos de dashboard tienen valores y rutas exactas. ✓
- **Consistencia de tipos:** `deleteAll`, `emptyBucket`, `questionId`, IDs de variantes y `ClientDef` se usan de forma consistente. ✓
