# Contexto — Subsistema E: Editor de Día (Admin CMS)

## Qué construye este subsistema

El editor de día es la página central del CMS de Aura. Permite crear y editar
un `program_day` (metadata + bloques de contenido arrastrables).

Dos rutas:
- **Crear:** `/admin/content/[programId]/series/[seriesId]/days/new?week=N&dow=lunes`
- **Editar:** `/admin/content/[programId]/series/[seriesId]/days/[dayId]`

---

## Estado del proyecto al iniciar este subsistema

**Stack:** Next.js 14 App Router · TypeScript · Supabase PostgreSQL · Tailwind CSS  
**Tokens CSS** (en `globals.css`): `--lavanda`, `--lavanda-dark`, `--lavanda-tint`,
`--rosa-soft`, `--negro`, `--gris-texto`, `--gris-suave`, `--gris-linea`, `--shadow-card`  
**Tipografías:** `font-head` = Oswald, `font-body` = Hind  
**Librerías en package.json:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@tiptap/react`,
`@tiptap/starter-kit`, `lucide-react`, `@supabase/supabase-js`

**Subsistemas previos completados:**
- `/portal/today` funcional con bloques renderizados
- Admin layout con sidebar (`app/admin/layout.tsx`)
- `/admin/content` y `/admin/content/[programId]` con `WeeklyGrid` + `SeriesAccordion`
- `WeeklyGrid.tsx`: celdas vacías tienen link a `.../days/new?week=N&dow=dow`
- `WeeklyGrid.tsx`: celdas existentes tienen link a `.../days/[dayId]`

**Patrón Supabase en admin:** usar `supabaseServer()` en server components;
los selects anidados requieren cast `as unknown as Type` (los tipos generados
no reconocen las relaciones).

---

## Esquema SQL relevante

```sql
-- program_days
id UUID PK
series_id UUID FK → program_series(id)
week_number INT        -- 1..4
day_of_week TEXT       -- 'lunes'|'martes'|'miercoles'|'jueves'|'viernes'|'sabado'|'domingo'
workout_focus TEXT     -- nullable; NULL = día de descanso
title TEXT NOT NULL
description TEXT
day_type TEXT          -- 'workout'|'rest'|'assessment'
duration_minutes INT
published BOOLEAN DEFAULT false
UNIQUE(series_id, week_number, day_of_week)

-- program_day_blocks
id UUID PK
day_id UUID FK → program_days(id)
block_type TEXT  -- 'text'|'youtube'|'pdf'|'image'|'exercise_list'
sort_order INT
content JSONB NOT NULL
```

### JSONB por tipo de bloque

```jsonc
// text
{ "html": "<h2>Título</h2><p>Párrafo...</p>" }

// youtube
{ "video_id": "dQw4w9WgXcQ", "title": "Calentamiento 5 min" }

// pdf
{ "storage_path": "pdfs/mes1-semana1-lunes.pdf",
  "filename": "Guía Mes 1.pdf",
  "label": "Descarga la guía" }

// image
{ "storage_path": "images/mes1-postura.jpg", "alt": "Postura correcta" }

// exercise_list
{
  "exercises": [
    {
      "id": "ex-001",           // string único (puede ser uuid v4)
      "name": "Sentadilla",
      "sets": 3,
      "reps": "12",             // string (puede ser "10 por lado", "30 segundos")
      "rest_seconds": 60,
      "notes": "Notas coach",   // muestra en portal en itálica
      "video_url": "",          // URL de YouTube para demo del ejercicio (opcional)
      "metrics": ["reps_done", "weight_kg"]  // qué campos registra la clienta
      //          "reps_done" siempre; "weight_kg" solo si usa peso
    }
  ]
}
```

---

## Archivos a crear/modificar

### Crear (nuevos):
```
app/admin/content/[programId]/series/[seriesId]/days/
  new/page.tsx           — formulario de creación (server component shell)
  [dayId]/page.tsx       — formulario de edición (server component shell)

components/admin/
  DayEditorForm.tsx      — client component: toda la UI del editor
  blocks/
    TextBlockEditor.tsx
    YoutubeBlockEditor.tsx
    PdfBlockEditor.tsx
    ImageBlockEditor.tsx
    ExerciseListBlockEditor.tsx

lib/admin/
  dayActions.ts          — server actions: saveDay, saveBlocks, deleteBlock, reorderBlocks

app/api/admin/
  upload/route.ts        — POST: recibe FormData, sube a Supabase Storage, retorna storage_path
```

### Modificar:
```
lib/admin/queries.ts     — agregar getDayWithBlocks(dayId): Promise<DayWithBlocks | null>
```

---

## Diseño del editor (qué construir exactamente)

### Sección superior — Metadata del día

```
[Breadcrumb: Contenido > CuarentaMás > Mes 1 > Semana 1 — Lunes]

Título del día        [input text]
Enfoque (workout_focus) [input text — opcional; vacío = día de descanso]
Tipo                  [select: Entrenamiento / Descanso / Evaluación]
Duración (min)        [input number — opcional]

[toggle publicado / borrador]          [Guardar]
```

El `week_number` y `day_of_week` vienen de `params` o `searchParams` (new) y
se muestran como texto no editable (ya fijados por la celda desde la que se llegó).

### Sección inferior — Bloques arrastrables

```
┌─────────────────────────────────────────────────────┐
│ ⠿  [Texto] Bienvenida a tu primer entrenamiento...  │ [✕]
├─────────────────────────────────────────────────────┤
│ ⠿  [YouTube] dQw4w9WgXcQ — Calentamiento 5 min     │ [✕]
├─────────────────────────────────────────────────────┤
│ ⠿  [Ejercicios] 4 ejercicios                        │ [✕]
└─────────────────────────────────────────────────────┘

[+ Agregar bloque ▾]
  • Texto
  • Video YouTube
  • PDF
  • Imagen
  • Lista de ejercicios
```

El drag handle `⠿` usa `useSortable` de `@dnd-kit/sortable`.
Al hacer clic en un bloque, se expande su editor inline (no modal).

---

## Arquitectura sugerida

### Server actions (`lib/admin/dayActions.ts`)

```typescript
"use server";

// Crea o actualiza un program_day (metadata)
export async function saveDay(data: {
  id?: string;                // si existe → UPDATE; si no → INSERT
  seriesId: string;
  weekNumber: number;
  dayOfWeek: string;
  title: string;
  workoutFocus: string | null;
  dayType: "workout" | "rest" | "assessment";
  durationMinutes: number | null;
  published: boolean;
}): Promise<{ dayId: string; error?: string }>

// Guarda bloques (upsert completo: borra los que no están en la lista)
export async function saveBlocks(
  dayId: string,
  blocks: Array<{ id?: string; block_type: string; sort_order: number; content: object }>
): Promise<{ error?: string }>

// Sube archivo a Supabase Storage (llamado desde el cliente vía /api/admin/upload)
// El endpoint devuelve { storage_path: string }
```

### Client component (`components/admin/DayEditorForm.tsx`)

```typescript
"use client";
// Props: day (DayWithBlocks | null), seriesId, programId, weekNumber, dayOfWeek
// Estado local: metadata fields + blocks array
// dnd-kit: DndContext + SortableContext (strategy: verticalListSortingStrategy)
// Al guardar: llama saveDay → luego saveBlocks con los blocks actuales
```

### Tipos

```typescript
// En lib/admin/queries.ts
export interface BlockData {
  id: string;
  block_type: "text" | "youtube" | "pdf" | "image" | "exercise_list";
  sort_order: number;
  content: Record<string, unknown>;
}

export interface DayWithBlocks {
  id: string;
  series_id: string;
  week_number: number;
  day_of_week: string;
  workout_focus: string | null;
  title: string;
  description: string | null;
  day_type: string;
  duration_minutes: number | null;
  published: boolean;
  blocks: BlockData[];
}

export async function getDayWithBlocks(dayId: string): Promise<DayWithBlocks | null>
```

---

## Implementación de cada BlockEditor

### TextBlockEditor
- Usa Tiptap con `StarterKit` (bold, italic, headings H2/H3, listas)
- `editor.getHTML()` → guarda en `content.html`
- Toolbar mínima: negrita, cursiva, H2, lista UL

### YoutubeBlockEditor
- Input "URL de YouTube" → extrae video_id con regex:
  ```typescript
  function extractVideoId(url: string): string | null {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return m?.[1] ?? null;
  }
  ```
- Preview del thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
- Input `title` libre

### PdfBlockEditor / ImageBlockEditor
- `<input type="file">` → POST a `/api/admin/upload` con FormData
- El endpoint sube a Supabase Storage y devuelve `{ storage_path }`
- Muestra el filename/alt como confirmación

### ExerciseListBlockEditor
- Lista de ejercicios con "Agregar ejercicio" y "Eliminar"
- Cada ejercicio: name, sets (number), reps (text), rest_seconds, notes, video_url
- Checkboxes: "Registrar reps" y "Registrar peso (kg)" → generan array `metrics`
- IDs de ejercicio: generados con `crypto.randomUUID()` al crear

---

## API de upload (`app/api/admin/upload/route.ts`)

```typescript
// POST /api/admin/upload
// FormData: { file: File, bucket: "pdfs" | "images" }
// Usa SUPABASE_SERVICE_ROLE_KEY (supabaseAdmin)
// Retorna: { storage_path: string } o { error: string }
```

Bucket en Supabase Storage: `content` (o separar `pdfs` e `images` — usar el mismo `content`
con path prefix: `pdfs/filename.pdf`, `images/filename.jpg`).

---

## Patrones del proyecto a seguir

1. **Server components** para data fetching → client components para interactividad
2. **Supabase anon client** nunca en admin → usar `createServerClient` con service role
3. **Breadcrumb** igual al de `/admin/content/[programId]/page.tsx`
4. **Botón guardar** estilo lavanda: `background: var(--lavanda)`, `color: white`,
   `border-radius: 12px`, `font-family: Oswald`
5. **Cards de bloques:** `border: 1.5px solid var(--gris-linea)`, `border-radius: 12px`,
   `background: white`, `box-shadow: var(--shadow-card)`
6. **Colores de estado:** publicado = `var(--lavanda-tint)` / borrador = `#f0f0f0`
7. **No usar** `text-transform: capitalize` en CSS para texto dinámico (bug conocido)

---

## Orden de implementación recomendado

1. `lib/admin/queries.ts` → agregar `getDayWithBlocks`
2. `lib/admin/dayActions.ts` → `saveDay` + `saveBlocks`
3. `app/api/admin/upload/route.ts` → endpoint de archivos
4. `components/admin/DayEditorForm.tsx` → shell con metadata + lista de bloques (sin dnd aún)
5. Cada `BlockEditor` por separado (texto primero, ejercicios al final)
6. Agregar dnd-kit al `DayEditorForm` (wrappear con `DndContext` + `SortableContext`)
7. `app/admin/content/[programId]/series/[seriesId]/days/new/page.tsx`
8. `app/admin/content/[programId]/series/[seriesId]/days/[dayId]/page.tsx`
9. Smoke test: crear día → agregar bloques → reordenar → publicar → ver en /portal/today

---

## Gotchas conocidos

- `day_of_week` en la DB usa sin acento: `'miercoles'`, `'sabado'` (no `'miércoles'`)
- `series_id` en la ruta de la URL es el de `program_series`, no `program_variants`
- Para `new`, `weekNumber` y `dayOfWeek` vienen de `searchParams` (query string)
- El servidor Next.js 14 requiere `await params` y `await searchParams` (son Promises)
- Al hacer `supabase.storage.from('content').upload(path, file)`, verificar que el bucket
  exista y tenga policies de INSERT para service role
- dnd-kit requiere `CSS.Transform.toString(transform)` en el style del item arrastrable;
  usar el hook `useSortable` de `@dnd-kit/sortable`
