# Diseño — Subsistemas E y F: Editor de Día, Gestión de Contenido y Pilares

**Fecha:** 8 de junio de 2026
**Fase:** 2 — Contenido (cierre)
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Subsistemas previos:** A (portal/today), B (UI/UX portal), C (admin layout), D (CMS overview + grilla semanal)

---

## Objetivo

Cerrar la Fase 2 entregando:

- **Subsistema E — Editor de un día:** autoría completa de un `program_day` (metadata + bloques de contenido arrastrables) en el CMS de Aura.
- **Subsistema F — Gestión de contenido + Pilares:** operaciones entre días (clonar/duplicar/eliminar), más los pilares mensuales paralelos de CuarentaMás/Extra (modelo de datos, autoría en admin, despliegue en portal).

Al terminar, Aura puede crear todo el contenido de un programa y la clienta lo consume y registra progreso.

---

## Decisiones tomadas (brainstorming 2026-06-08)

| Decisión | Resolución |
|----------|-----------|
| Decomposición E vs F | E = editar UN día (incluye descanso editable + calculadora). F = clonar/duplicar/eliminar días + pilares mensuales. |
| Dónde ve la clienta los pilares | Sección aparte en el portal (`/portal/pilares`), reusando el sistema de bloques. |
| Alcance de clonado | Clonar día individual a otra celda + clonar semana completa. |
| Métricas de ejercicio | Mantener 2 checkboxes (reps/peso). El array `metrics` ya es extensible sin migración. |
| Meses de 5 semanas (P2) | La semana 5 repite el contenido de la semana 4. No abarca el mes siguiente (eso lo delimita el período de Stripe). |
| `day_type` "Evaluación" | Se renombra a "Protocolo Cardiovascular" (la opción `assessment`, sin uso, pasa a `cardio`). |
| Calculadora Cardio Zona 2 | Nuevo block type `cardio_zone2` que Aura agrega solo a los días que lo ameriten. Sin configuración (fórmula fija). Se renderiza en el portal: la clienta ingresa su edad y ve el rango en vivo, sin persistencia. |
| Días de descanso | Editables: un día de descanso puede ser una fila con bloques. |

---

## Parte 1 — Cambios de esquema (migración `004`)

Cuatro cambios, ninguno destructivo (no hay datos en `assessment` ni en pilares aún).

### 1.1 Rename de `day_type`

La constraint actual:
```sql
day_type text default 'workout' check (day_type in ('workout', 'rest', 'assessment'))
```
pasa a:
```sql
day_type text default 'workout' check (day_type in ('workout', 'rest', 'cardio'))
```

Etiquetas en UI (mapeo en admin y portal):

| valor DB | etiqueta |
|----------|----------|
| `workout` | Entrenamiento |
| `rest` | Descanso |
| `cardio` | Protocolo Cardiovascular |

### 1.2 Días de descanso editables — sin cambio de esquema

Hoy un día de descanso = **ausencia** de fila en `program_days`, y
`getTodayContent` hace `if (!day) return null` (`lib/content/queries.ts:148`),
mostrando una card genérica de descanso.

Nueva semántica (retrocompatible):

- Fila con `day_type='rest'` **que existe** → el portal renderiza sus bloques
  (información importante del día de descanso).
- **Sin fila** para `(week_number, day_of_week)` → card genérica de descanso
  (comportamiento actual, intacto).

`workout_focus` sigue siendo `NULL` en días de descanso; ya no es el único
indicador de "descanso".

### 1.3 Nuevo block type `cardio_zone2`

La constraint de `program_day_blocks.block_type` (y la de `program_pillar_blocks`,
abajo) agrega `cardio_zone2`:

```sql
-- program_day_blocks
alter table program_day_blocks drop constraint <nombre_check_block_type>;
alter table program_day_blocks add check (block_type in
  ('text','youtube','pdf','image','exercise_list','cardio_zone2'));
```

`content` del bloque `cardio_zone2` es `{}` (sin configuración: la fórmula es fija).
No se renderiza un helper en el editor; se renderiza interactivo en el portal.

### 1.4 Pilares mensuales — tablas nuevas

Reusan el sistema de bloques existente con tablas espejo.

```sql
create table program_series_pillars (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references program_series(id) on delete cascade,
  pillar_key text not null check (pillar_key in
    ('alimentacion','autoconocimiento','estres_sueno','respiraciones')),
  title text not null,
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(series_id, pillar_key)
);

create table program_pillar_blocks (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references program_series_pillars(id) on delete cascade,
  block_type text not null check (block_type in
    ('text','youtube','pdf','image','exercise_list','cardio_zone2')),
  sort_order int not null,
  content jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Mapeo de `pillar_key` → nombre visible:

| `pillar_key` | Nombre |
|--------------|--------|
| `alimentacion` | Alimentación con intención |
| `autoconocimiento` | Autoconocimiento |
| `estres_sueno` | Manejo de estrés, descanso y sueño |
| `respiraciones` | Respiraciones y suelo pélvico |

- **Solo algunos meses** tienen pilares → solo se crean filas donde hay contenido.
- **Solo CuarentaMás/Extra** → se aplica en la UI del admin y en la query del portal (gate por programa). Strong & Fit no muestra ni edita pilares.
- **RLS** espejo de `program_days`/`program_day_blocks`: lectura si `published` o admin; escritura solo admin. Triggers `set_updated_at`.

---

## Parte 2 — Subsistema E: Editor de un día

### Rutas

- Crear: `/admin/content/[programId]/series/[seriesId]/days/new?week=N&dow=lunes`
- Editar: `/admin/content/[programId]/series/[seriesId]/days/[dayId]`

`week_number` y `day_of_week` vienen de `searchParams` (new) o de la fila (edit) y
se muestran como texto no editable. `day_of_week` en DB es sin acento
(`miercoles`, `sabado`).

### Archivos

**Nuevos:**
```
app/admin/content/[programId]/series/[seriesId]/days/
  new/page.tsx           — server component shell (crear)
  [dayId]/page.tsx       — server component shell (editar)

components/admin/
  DayEditorForm.tsx      — client component: metadata + lista de bloques + dnd
  blocks/
    TextBlockEditor.tsx
    YoutubeBlockEditor.tsx
    PdfBlockEditor.tsx
    ImageBlockEditor.tsx
    ExerciseListBlockEditor.tsx
    CardioZone2BlockEditor.tsx — trivial: sin campos (solo confirma "se agregó")

components/portal/blocks/
  CardioZone2Block.tsx   — renderer interactivo: input edad → muestra el rango

lib/admin/dayActions.ts  — server actions: saveDay, saveBlocks
                           (+ cloneDay, cloneWeek, deleteDay en Subsistema F)
lib/content/cardio.ts    — función pura cardioZone2(edad)
lib/admin/youtube.ts     — función pura extractVideoId(url)

app/api/admin/upload/route.ts — POST FormData → Supabase Storage → { storage_path }
```

**Modificar:**
```
lib/admin/queries.ts     — agregar getDayWithBlocks(dayId): Promise<DayWithBlocks | null>
lib/content/queries.ts   — soportar día de descanso con fila (no return null si day_type='rest')
                           + clamp de semana a 4 (meses de 5 semanas)
components/portal/TodayView.tsx — renderizar día de descanso con bloques + badge day_type
                           + caso 'cardio_zone2' → <CardioZone2Block />
```

### Sección de metadata

- Título (text)
- Enfoque / `workout_focus` (text, opcional; vacío permitido)
- Tipo (select): Entrenamiento / Descanso / Protocolo Cardiovascular
- Duración en minutos (number, opcional)
- Toggle publicado / borrador
- Botón Guardar (estilo lavanda)

Si el tipo es Descanso, `workout_focus` es opcional pero **se permiten bloques**.

### Block type Cardio Zona 2 (`cardio_zone2`)

No es un helper del editor: es un **bloque** que Aura agrega solo a los días que
lo ameriten (vía "Agregar bloque ▾ → Calculadora Cardio Zona 2"). El editor del
bloque es trivial (no hay nada que configurar; `content = {}`).

**Renderer en el portal** (`components/portal/blocks/CardioZone2Block.tsx`): la
clienta ingresa su edad y ve el rango en vivo, **sin persistencia**:

```
edad (años) → suelo = round((220 − edad) × 0.60)
            → cielo = round((220 − edad) × 0.70)
```

Texto exacto del resultado:

> **Tu Cardio zona 2 se encuentra en el rango: {suelo} – {cielo}**

La aritmética se extrae a `lib/content/cardio.ts` → `cardioZone2(edad): { suelo, cielo }`
(enteros redondeados) para poder testearla y reusarla en el renderer.

### Editores de bloque

- **TextBlockEditor:** Tiptap `StarterKit` (negrita, cursiva, H2/H3, listas UL).
  `editor.getHTML()` → `content.html`.
- **YoutubeBlockEditor:** input URL → `extractVideoId` (regex). Preview con
  thumbnail propio (`https://img.youtube.com/vi/{id}/mqdefault.jpg`) + input `title`.
  El render en portal ya minimiza enlaces (`react-lite-youtube-embed`, `rel=0`,
  `modestbranding=1`, `iv_load_policy=3`).
- **PdfBlockEditor / ImageBlockEditor:** `<input type="file">` → POST
  `/api/admin/upload` → `{ storage_path }`.
- **ExerciseListBlockEditor:** lista con agregar/eliminar ejercicio. Por ejercicio:
  name, sets (number), reps (text), rest_seconds, notes, video_url. Dos checkboxes
  ("Registrar reps" / "Registrar peso (kg)") → array `metrics` (`reps_done`,
  `weight_kg`). IDs con `crypto.randomUUID()`.
- **CardioZone2BlockEditor:** trivial. Sin campos editables; solo muestra una nota
  de que la clienta verá la calculadora en el portal. `content = {}`.

### Server actions

```typescript
saveDay(data): Promise<{ dayId: string; error?: string }>   // INSERT o UPDATE
saveBlocks(dayId, blocks): Promise<{ error?: string }>      // upsert completo:
                                                            // borra los no presentes
```

### dnd-kit

`DndContext` + `SortableContext` (`verticalListSortingStrategy`). El drag handle usa
`useSortable`; al guardar se reescribe `sort_order` según el orden actual.

### Cambios en el portal (parte de E)

- `lib/content/queries.ts`: un día con `day_type='rest'` y fila existente devuelve
  el día + sus bloques (no `null`). La card genérica de descanso solo cuando no hay fila.
- `lib/content/queries.ts` / `lib/content/access.ts`: clamp de semana a 4
  (`weekNumber = min(computado, 4)`) para meses de 5 semanas.
- `TodayView.tsx`: badge de `day_type` para `cardio` (Protocolo Cardiovascular) y
  `rest`; renderizar bloques en día de descanso.

### API de upload

`POST /api/admin/upload` — FormData `{ file, bucket }`. Usa `SUPABASE_SERVICE_ROLE_KEY`.
Bucket `content` con prefijo de path (`pdfs/…`, `images/…`). Retorna `{ storage_path }`
o `{ error }`. Verificar que el bucket exista con policies de INSERT para service role.

---

## Parte 3 — Subsistema F: Gestión de contenido + Pilares

### F.1 — Operaciones de días

Desde `WeeklyGrid` / `SeriesAccordion` (acciones por celda y por fila de semana):

- **Clonar / duplicar día** → a otra celda (semana/día destino) dentro de la misma
  serie. Copia metadata + bloques. Si el destino está ocupado → confirma sobrescribir.
- **Clonar semana completa** → copia todas las filas de la semana origen a una
  semana destino (mismo `day_of_week`).
- **Eliminar día** → borra la fila + bloques en cascada, con diálogo de confirmación.

Server actions en `lib/admin/dayActions.ts`:
```typescript
cloneDay(sourceDayId, target: { weekNumber, dayOfWeek }, overwrite): Promise<{ dayId?, error? }>
cloneWeek(seriesId, sourceWeek, targetWeek, overwrite): Promise<{ error? }>
deleteDay(dayId): Promise<{ error? }>
```

### F.2 — Pilares mensuales

**Admin:**
- En cada serie de CuarentaMás/Extra, entrada "Pilares" → página
  `/admin/content/[programId]/series/[seriesId]/pillars` que lista los 4 pilares
  (creados o por crear).
- Cada pilar abre un editor que **reusa la sección de bloques** del editor de día,
  con metadata ligera (título + publicado).
- No aparece en Strong & Fit (gate por programa).

**Portal:**
- Nueva sección `/portal/pilares`, visible solo para suscripción CuarentaMás/Extra
  activa (ítem de nav condicional).
- Muestra los pilares **publicados del mes actual** (`months_elapsed` → serie),
  cada uno como acordeón/tab que reusa los renderers de bloques del portal.
- Acceso solo al mes actual (histórico de pilares fuera de alcance — YAGNI).

Query nueva en `lib/content/queries.ts`:
```typescript
getCurrentMonthPillars(subscription): Promise<Pillar[]>  // [] si el programa no es CuarentaMás/Extra
```

---

## Parte 4 — Pruebas (cierre de Fase 2)

### Automatizadas (vitest, ya configurado)

- `cardioZone2(edad)` → rango `{ suelo, cielo }` correcto (enteros redondeados).
- `extractVideoId(url)` → varias formas de URL (`watch?v=`, `youtu.be/`, con params).
- `dayActions`:
  - `saveDay` insert y update.
  - `saveBlocks` upsert completo (borra los bloques removidos de la lista).
  - `cloneDay` copia metadata + bloques.
  - `cloneWeek` copia todas las filas de la semana.
  - `deleteDay` borra fila + bloques en cascada.
- `queries`:
  - `getDayWithBlocks` devuelve día + bloques ordenados.
  - Día de descanso **con fila** devuelve bloques (no `null`).
  - Semana calculada 5 → sirve contenido de semana 4 (clamp).
  - `getCurrentMonthPillars` hace gate: programa no-CuarentaMás devuelve `[]`.

### Smoke manual (checklist)

1. Crear día → agregar los 6 tipos de bloque → reordenar (dnd) → publicar → verlo en `/portal/today`.
2. Día de descanso con info → portal renderiza los bloques (no card genérica).
3. Día tipo Protocolo Cardiovascular con bloque `cardio_zone2` → en el portal la clienta
   ingresa su edad y ve "Tu Cardio zona 2 se encuentra en el rango: suelo – cielo".
4. Clonar día a celda vacía; clonar semana completa.
5. Eliminar día → la celda de la grilla queda vacía.
6. Autor de un pilar en admin → aparece en `/portal/pilares` del mes actual.
7. Usuaria de Strong & Fit → **no** ve la sección de pilares.
8. Upload PDF e imagen → se renderizan en el portal.

Cierre con la skill `verification-before-completion`.

---

## Fuera de alcance (anotado, no bloquea)

- Editar registros (logs) pasados desde `/portal/history/[logId]` (P3 — es Fase 3).
- Histórico de pilares de meses anteriores en el portal.
- Clonar serie/mes completo entre variantes (puede agregarse después si se necesita).

---

## Archivos críticos afectados

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/004_*.sql` | rename `day_type`, `block_type += cardio_zone2`, tablas de pilares + RLS |
| `components/admin/DayEditorForm.tsx` | nuevo — editor de día |
| `components/admin/blocks/*` | nuevos — 6 editores de bloque (incluye `CardioZone2BlockEditor`) |
| `components/portal/blocks/CardioZone2Block.tsx` | nuevo — renderer interactivo de la calculadora |
| `lib/admin/dayActions.ts` | nuevo — saveDay/saveBlocks/cloneDay/cloneWeek/deleteDay |
| `lib/admin/queries.ts` | `getDayWithBlocks` |
| `lib/content/queries.ts` | descanso con fila, clamp semana, `getCurrentMonthPillars` |
| `lib/content/cardio.ts`, `lib/admin/youtube.ts` | nuevos — funciones puras |
| `app/api/admin/upload/route.ts` | nuevo — upload a Storage |
| `components/portal/TodayView.tsx` | badge day_type + render descanso con bloques + caso `cardio_zone2` |
| `app/portal/pilares/*` | nuevo — sección de pilares |
| `components/admin/WeeklyGrid.tsx` / `SeriesAccordion.tsx` | acciones clonar/eliminar |
