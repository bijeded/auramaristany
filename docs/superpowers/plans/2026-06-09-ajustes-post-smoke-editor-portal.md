# Ronda de Ajustes Post-Smoke (Editor + Portal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir y pulir los Subsistemas E/F tras el smoke test del 9-jun: rediseñar el editor de día acercándolo al prototipo, eliminar el selector de tipo de día (D2), arreglar render de listas/espaciado de texto, y aplicar correcciones puntuales en bloques, grilla y portal.

**Architecture:** Cambios sobre la rama existente `feature/fase-2-editor-pilares` (E/F ya implementados). La mayoría son cambios de UI en client components con Tailwind + tokens CSS de la app; la pieza grande es el restyle de `DayEditorForm`/`BlockListEditor`/`PillarEditorForm` siguiendo el prototipo `design-handoff-aura/prototype/aura/admin-content.jsx` (sin panel de preview). Un fix de raíz (instalar `@tailwindcss/typography`) resuelve de una vez el render de listas y el espaciado del texto.

**Tech Stack:** Next.js 14, TypeScript, Tailwind (+ @tailwindcss/typography a instalar), Tiptap, dnd-kit, tokens en `app/globals.css`.

**Contexto de referencia:** `docs/superpowers/context/2026-06-09-ajustes-post-smoke-editor-portal.md` (triaje + decisiones D1–D4). Spec v1.2: `SPEC.md`.

---

## Decisiones que guían este plan

- **D1:** rediseñar el editor acercándolo al prototipo. **Sin preview en vivo.**
- **D2:** quitar el selector de tipo de día. Todos son "Programa de Actividad Física" + Enfoque libre (`workout_focus`). Días de descanso llevan contenido. `day_type` queda sin uso (default `workout`, sin migración nueva). La card de descanso del portal solo aparece cuando NO hay fila.
- **A4:** estado Publicado/Borrador como **dropdown**, ubicado **al lado del botón Guardar** (derecha del top bar).
- **A5:** fondo blanco solo en `/portal/today`.
- Pilares: empty-state claro cuando el mes no tiene pilares.

## Tokens disponibles (app/globals.css)
`--rosa`, `--rosa-soft`, `--rosa-deep`, `--lavanda`, `--lavanda-dark`, `--lavanda-soft`, `--lavanda-tint`, `--negro`, `--blanco`, `--gris-claro`, `--gris-linea`, `--gris-texto`, `--gris-suave`, `--error`, `--error-tint`, `--exito`, `--font-head` (Oswald), `--font-body` (Hind), `--r-card` (12px), `--r-lg` (16px), `--shadow-card`. No hay clases `.btn`/`.input` (esas son del prototipo) → estilar con Tailwind + estos tokens.

---

## File Structure

| Archivo | Cambio |
|---------|--------|
| `package.json` | + `@tailwindcss/typography` |
| `tailwind.config.ts` | registrar el plugin typography |
| `app/globals.css` | estilos de `.prose` (headings/listas/espaciado) para texto renderizado |
| `components/admin/blocks/TextBlockEditor.tsx` | toolbar: + H3, H4, OL |
| `components/admin/blocks/ImageBlockEditor.tsx` | preview de imagen tras subir |
| `components/admin/blocks/ExerciseListBlockEditor.tsx` | etiquetas en Series/Reps/Descanso |
| `components/admin/BlockListEditor.tsx` | paleta "Agregar bloque" como fila de botones con ícono + polish de card |
| `components/admin/DayEditorForm.tsx` | rediseño: top bar (back + estado dropdown junto a Guardar) + metadata; quitar selector de tipo |
| `components/admin/PillarEditorForm.tsx` | top bar consistente (back + estado dropdown) |
| `components/admin/DayCellMenu.tsx` | cerrar menú al clic afuera |
| `components/admin/SeriesAccordion.tsx` | botón "Pilares del mes" resaltado |
| `components/portal/TodayView.tsx` | fondo blanco; quitar badges de tipo; simplificar lógica de descanso |
| `components/portal/blocks/CardioZone2Block.tsx` | validar edad 18–110 + mejor visual |
| `components/portal/PillarsView.tsx` | empty-state diseñado |

---

## FASE A — Render de texto + fixes de bloques

### Task A1: Instalar @tailwindcss/typography (arregla listas + espaciado)

**Causa raíz:** `components/portal/blocks/TextBlock.tsx` y el editor usan la clase `prose`, pero el plugin `@tailwindcss/typography` NO está instalado → `prose` es no-op → las listas pierden viñetas/números (reset de Tailwind) y no hay espaciado entre encabezados y párrafos. Esto cubre el bug de UL (B3) y el espaciado (A6).

**Files:**
- Modify: `package.json`, `tailwind.config.ts`, `app/globals.css`

- [ ] **Step 1: Install the plugin**

Run: `npm install -D @tailwindcss/typography`
Expected: se agrega a devDependencies sin errores.

- [ ] **Step 2: Register the plugin in `tailwind.config.ts`**

Lee `tailwind.config.ts`. En el array `plugins`, agrega:
```ts
plugins: [require("@tailwindcss/typography")],
```
(Si ya hay otros plugins, agrégalo a la lista; no quites los existentes.)

- [ ] **Step 3: Add prose spacing/list styles in `app/globals.css`**

Al final de `app/globals.css`, agrega reglas que garanticen viñetas/numeración y espaciado legible para el HTML renderizado de Tiptap (aplica tanto al portal como al editor, ambos usan `.prose`):
```css
.prose { line-height: 1.6; }
.prose h2 { font-family: var(--font-head); font-size: 1.25rem; font-weight: 600; margin-top: 1.1em; margin-bottom: 0.4em; }
.prose h3 { font-family: var(--font-head); font-size: 1.1rem; font-weight: 600; margin-top: 1em; margin-bottom: 0.35em; }
.prose h4 { font-family: var(--font-head); font-size: 1rem; font-weight: 600; margin-top: 0.9em; margin-bottom: 0.3em; }
.prose p { margin-top: 0; margin-bottom: 0.8em; }
.prose ul { list-style: disc; padding-left: 1.4em; margin-bottom: 0.8em; }
.prose ol { list-style: decimal; padding-left: 1.4em; margin-bottom: 0.8em; }
.prose li { margin-bottom: 0.25em; }
```

- [ ] **Step 4: Verify build + manual check**

Run: `npx tsc --noEmit` → sin errores. Run: `npm run build` → OK.
(El render visual se valida en el smoke: un bloque de texto con UL/OL y encabezados muestra viñetas/números y espaciado.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tailwind.config.ts app/globals.css
git commit -m "fix: install @tailwindcss/typography + prose styles (lists + heading spacing)"
```

### Task A2: TextBlockEditor — agregar H3, H4 y lista ordenada

**Files:**
- Modify: `components/admin/blocks/TextBlockEditor.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/admin/blocks/TextBlockEditor.tsx`. Hoy tiene botones para Bold, Italic, H2 (`toggleHeading level 2`) y bulletList. StarterKit ya incluye headings (1–6), bulletList y orderedList.

- [ ] **Step 2: Add H3, H4 and ordered-list buttons**

Importa los íconos necesarios de `lucide-react` (`Heading3`, `ListOrdered`; para H4 usa el texto "H4" si no hay ícono claro). Agrega botones replicando el patrón del botón H2 existente:
```tsx
<button type="button" className={btn(editor.isActive("heading", { level: 3 }))}
  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></button>
<button type="button" className={btn(editor.isActive("heading", { level: 4 }))}
  onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
  style={{ fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 700 }}>H4</button>
<button type="button" className={btn(editor.isActive("orderedList"))}
  onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></button>
```
Mantén los botones existentes (B, I, H2, UL). Orden sugerido: B, I, H2, H3, H4, UL (•), OL (1.).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → sin errores nuevos.
(Funcionamiento se valida en smoke; con A1 ya instalado, UL/OL muestran marcadores dentro del editor.)

- [ ] **Step 4: Commit**

```bash
git add components/admin/blocks/TextBlockEditor.tsx
git commit -m "feat: add H3/H4/ordered-list buttons to text block editor"
```

### Task A3: ImageBlockEditor — preview de la imagen

**Files:**
- Modify: `components/admin/blocks/ImageBlockEditor.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/admin/blocks/ImageBlockEditor.tsx`. Tras subir, guarda `content.storage_path` pero no muestra preview. La URL pública es `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content/${storage_path}` (mismo patrón que `components/portal/blocks/ImageBlock.tsx` — léelo para confirmar el formato exacto).

- [ ] **Step 2: Render a preview when storage_path exists**

Dentro del bloque `{content.storage_path && (...)}`, antes del input de alt, agrega la imagen:
```tsx
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content/${content.storage_path}`}
  alt={content.alt ?? "preview"}
  className="rounded-lg mb-2"
  style={{ maxWidth: 220, border: "1px solid var(--gris-linea)" }}
/>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add components/admin/blocks/ImageBlockEditor.tsx
git commit -m "feat: show image preview after upload in image block editor"
```

### Task A4: ExerciseListBlockEditor — etiquetas claras

**Files:**
- Modify: `components/admin/blocks/ExerciseListBlockEditor.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/admin/blocks/ExerciseListBlockEditor.tsx`. Los 3 campos (sets, reps, rest_seconds) hoy solo tienen `placeholder`. Queremos etiquetas claras encima de cada uno.

- [ ] **Step 2: Add a label above each of the three fields**

Envuelve cada uno de los inputs de `sets`, `reps`, `rest_seconds` en una columna con su etiqueta. Reemplaza el `div.row gap-2` de esos tres inputs por:
```tsx
<div className="flex gap-3 flex-wrap">
  <label className="flex flex-col gap-1 font-body" style={{ fontSize: 12, color: "var(--gris-texto)" }}>
    Series
    <input className={`${input} w-20`} style={border} type="number"
      value={ex.sets} onChange={(e) => setField(i, { sets: Number(e.target.value) })} />
  </label>
  <label className="flex flex-col gap-1 font-body" style={{ fontSize: 12, color: "var(--gris-texto)" }}>
    Repeticiones
    <input className={`${input} w-24`} style={border}
      value={ex.reps} onChange={(e) => setField(i, { reps: e.target.value })} />
  </label>
  <label className="flex flex-col gap-1 font-body" style={{ fontSize: 12, color: "var(--gris-texto)" }}>
    Descanso (seg)
    <input className={`${input} w-28`} style={border} type="number"
      value={ex.rest_seconds} onChange={(e) => setField(i, { rest_seconds: Number(e.target.value) })} />
  </label>
</div>
```
(Conserva los nombres de campo/handlers existentes — `setField`, `input`, `border` ya están en el archivo.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add components/admin/blocks/ExerciseListBlockEditor.tsx
git commit -m "feat: label Series/Repeticiones/Descanso fields in exercise editor"
```

---

## FASE B — Rediseño del editor

### Task B1: BlockListEditor — paleta de bloques como botones con ícono

**Files:**
- Modify: `components/admin/BlockListEditor.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/admin/BlockListEditor.tsx`. Hoy la sección "Agregar bloque" es un botón que abre un dropdown (menú vertical). Lo cambiamos por una fila de botones con ícono (más claro), uno por tipo de bloque.

- [ ] **Step 2: Replace the dropdown with an icon-button palette**

Importa íconos de `lucide-react`: `Type, Youtube, FileText, Image as ImageIcon, Dumbbell, HeartPulse, Plus`. Define un mapa de íconos por tipo y reemplaza el bloque del menú (`menuOpen` + dropdown) por:
```tsx
const BLOCK_ICONS: Record<BlockType, React.ComponentType<{ size?: number; color?: string }>> = {
  text: Type, youtube: Youtube, pdf: FileText, image: ImageIcon,
  exercise_list: Dumbbell, cardio_zone2: HeartPulse,
};

// ...en el JSX, en vez del dropdown:
<div className="mt-2">
  <div className="font-body mb-2" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", color: "var(--gris-suave)", textTransform: "uppercase" }}>
    Agregar bloque
  </div>
  <div className="flex gap-2 flex-wrap">
    {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => {
      const Ico = BLOCK_ICONS[t];
      return (
        <button key={t} type="button" onClick={() => addBlock(t)}
          className="flex items-center gap-1.5 font-body rounded-lg px-3 py-2"
          style={{ fontSize: 13, border: "1px solid var(--gris-linea)", background: "white", color: "var(--negro)" }}>
          <Ico size={16} color="var(--lavanda-dark)" /> {BLOCK_LABELS[t]}
        </button>
      );
    })}
  </div>
</div>
```
Puedes eliminar el estado `menuOpen` y su lógica si ya no se usa. Mantén intactos `addBlock`, `renderEditor`, el `DndContext`/`SortableContext` y `SortableBlock`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add components/admin/BlockListEditor.tsx
git commit -m "feat: block palette as icon buttons (admin editor)"
```

### Task B2: DayEditorForm — rediseño (top bar + metadata, sin tipo de día)

**Files:**
- Modify: `components/admin/DayEditorForm.tsx`

Cambios: (1) top bar con link de regreso a la grilla del programa + a la derecha **dropdown de estado Publicado/Borrador junto al botón Guardar**; (2) metadata en una sola columna: etiqueta fija "Programa de Actividad Física", Título, Enfoque (`workout_focus`), Duración; (3) **quitar el selector de tipo de día** (`DAY_TYPE_OPTIONS`/`dayType`), enviando siempre `dayType: "workout"` a `saveDay`.

- [ ] **Step 1: Read the current file**

Lee `components/admin/DayEditorForm.tsx` completo. Tiene estado `title`, `workoutFocus`, `dayType`, `duration`, `published`, `blocks`, `saving`; `DAY_TYPE_OPTIONS`; `handleSave` (llama `saveDay` con `dayType` y luego `saveBlocks`); el JSX de metadata con el `<select>` de tipo; y `<BlockListEditor>`.

- [ ] **Step 2: Remove the day_type selector and its state**

- Elimina `DAY_TYPE_OPTIONS` y el `useState` de `dayType`.
- En `handleSave`, pasa `dayType: "workout"` fijo a `saveDay` (la firma de `saveDay` no cambia).
- Quita el `<select>` de tipo del JSX.

- [ ] **Step 3: Add the top bar (back link + state dropdown next to Guardar)**

Importa `Link` de `next/link` y `ChevronLeft` de `lucide-react`. La prop `programId` ya existe. Reemplaza el encabezado/área superior por un top bar:
```tsx
<div className="flex items-center justify-between mb-6">
  <Link href={`/admin/content/${programId}`}
    className="flex items-center gap-1 font-body" style={{ fontSize: 14, color: "var(--lavanda-dark)" }}>
    <ChevronLeft size={16} /> Volver a la serie
  </Link>
  <div className="flex items-center gap-2">
    <select value={published ? "publicado" : "borrador"}
      onChange={(e) => setPublished(e.target.value === "publicado")}
      className="rounded-lg border px-3 py-2 font-body" style={{ fontSize: 13, borderColor: "var(--gris-linea)" }}>
      <option value="borrador">Borrador</option>
      <option value="publicado">Publicado</option>
    </select>
    <button type="button" onClick={handleSave} disabled={saving || title.trim() === ""}
      className="font-head px-6 py-2.5 rounded-xl text-white disabled:opacity-50"
      style={{ background: "var(--lavanda)" }}>
      {saving ? "Guardando…" : "Guardar"}
    </button>
  </div>
</div>
```
(Elimina el viejo botón Guardar de abajo y el viejo checkbox de "Publicado" para no duplicarlos.)

- [ ] **Step 4: Redesign the metadata block**

Reemplaza la metadata por: etiqueta fija + Título + Enfoque + Duración (mantén `weekNumber`/`dayOfWeek` como texto no editable, ya presente):
```tsx
<div className="mb-2 font-body" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", color: "var(--lavanda-dark)", textTransform: "uppercase" }}>
  Programa de Actividad Física
</div>
<p className="font-body mb-4" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
  Semana {weekNumber} — {dayOfWeek}
</p>
<div className="space-y-3 mb-6">
  <div>
    <label className="block font-body mb-1" style={{ fontSize: 12, color: "var(--gris-texto)" }}>Título del día</label>
    <input className={field} style={border} value={title} onChange={(e) => setTitle(e.target.value)}
      style={{ ...border, fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 18 }} />
  </div>
  <div>
    <label className="block font-body mb-1" style={{ fontSize: 12, color: "var(--gris-texto)" }}>Enfoque</label>
    <input className={field} style={border} placeholder="Ej. Tren Inferior, Protocolo Cardiovascular, Descanso"
      value={workoutFocus} onChange={(e) => setWorkoutFocus(e.target.value)} />
  </div>
  <div>
    <label className="block font-body mb-1" style={{ fontSize: 12, color: "var(--gris-texto)" }}>Duración (min)</label>
    <input className={field} style={{ ...border, width: 120 }} type="number"
      value={duration} onChange={(e) => setDuration(e.target.value)} />
  </div>
</div>
```
(Nota: un input no puede tener dos props `style`; combina en uno solo. `field` y `border` ya existen en el archivo.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → sin errores. Run: `npm run build` → OK.

- [ ] **Step 6: Commit**

```bash
git add components/admin/DayEditorForm.tsx
git commit -m "feat: redesign day editor (top bar, state dropdown, no day-type selector)"
```

### Task B3: PillarEditorForm — top bar consistente (back + estado)

**Files:**
- Modify: `components/admin/PillarEditorForm.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/admin/PillarEditorForm.tsx`. Tiene `title`, `published`, `blocks`, `saving`; `handleSave` (llama `savePillar` luego `savePillarBlocks`); recibe `programId`, `seriesId`, `pillarKey`, `pillarName`. Hoy el "Publicado" es checkbox y no hay botón de regreso (B5).

- [ ] **Step 2: Add top bar (back link + state dropdown + Guardar)**

Importa `Link` y `ChevronLeft`. Reemplaza el encabezado por un top bar consistente con el del editor de día:
```tsx
<div className="flex items-center justify-between mb-4">
  <Link href={`/admin/content/${programId}/series/${seriesId}/pillars`}
    className="flex items-center gap-1 font-body" style={{ fontSize: 14, color: "var(--lavanda-dark)" }}>
    <ChevronLeft size={16} /> Volver a pilares
  </Link>
  <div className="flex items-center gap-2">
    <select value={published ? "publicado" : "borrador"}
      onChange={(e) => setPublished(e.target.value === "publicado")}
      className="rounded-lg border px-3 py-2 font-body" style={{ fontSize: 13, borderColor: "var(--gris-linea)" }}>
      <option value="borrador">Borrador</option>
      <option value="publicado">Publicado</option>
    </select>
    <button type="button" onClick={handleSave} disabled={saving || title.trim() === ""}
      className="font-head px-6 py-2.5 rounded-xl text-white disabled:opacity-50"
      style={{ background: "var(--lavanda)" }}>
      {saving ? "Guardando…" : "Guardar"}
    </button>
  </div>
</div>
<h1 className="font-head text-xl mb-3">{pillarName}</h1>
```
Quita el checkbox de "Publicado" y el botón Guardar de abajo (ahora viven en el top bar).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/admin/PillarEditorForm.tsx
git commit -m "feat: pillar editor top bar (back link + state dropdown)"
```

---

## FASE C — Grilla + portal

### Task C1: DayCellMenu — cerrar al hacer clic afuera

**Files:**
- Modify: `components/admin/DayCellMenu.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/admin/DayCellMenu.tsx`. Usa `useState` `open`; el menú no se cierra al clic afuera.

- [ ] **Step 2: Add an outside-click handler**

Agrega un `ref` al contenedor y un efecto que cierra al hacer mousedown afuera:
```tsx
import { useRef, useEffect } from "react";
// ...dentro del componente:
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!open) return;
  function onDown(e: MouseEvent) {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }
  document.addEventListener("mousedown", onDown);
  return () => document.removeEventListener("mousedown", onDown);
}, [open]);
```
Pon `ref={ref}` en el `div` contenedor con `position: relative` (el wrapper del botón ⋮ + menú).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/admin/DayCellMenu.tsx
git commit -m "fix: close day cell menu on outside click"
```

### Task C2: SeriesAccordion — botón "Pilares del mes" resaltado

**Files:**
- Modify: `components/admin/SeriesAccordion.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/admin/SeriesAccordion.tsx`. El link "Pilares del mes" hoy es un link tenue (`color: var(--lavanda-dark)`, texto pequeño). Lo convertimos en un botón visible.

- [ ] **Step 2: Restyle the link as a clear button**

Reemplaza el `<Link>` de "Pilares del mes" por uno con estilo de botón (mantén el `href` y la condición de `programSlug`). Agrega un ícono `Layers` de `lucide-react`:
```tsx
<Link href={`/admin/content/${programId}/series/${series.id}/pillars`}
  className="inline-flex items-center gap-1.5 font-body rounded-lg px-3 py-1.5"
  style={{ fontSize: 13, fontWeight: 600, background: "var(--lavanda-soft)", color: "var(--lavanda-dark)", border: "1px solid var(--lavanda-soft)" }}>
  <Layers size={14} /> Pilares del mes
</Link>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/admin/SeriesAccordion.tsx
git commit -m "feat: make 'Pilares del mes' a visible button"
```

### Task C3: TodayView — fondo blanco + quitar badges de tipo + simplificar descanso (D2)

**Files:**
- Modify: `components/portal/TodayView.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/portal/TodayView.tsx`. Hay: el `div` raíz con `background: "var(--rosa-soft)"`; en `DayHeader` los badges de `cardio`/`rest` (agregados en Task 1.7); y el ternario de descanso `content.day.day_type === "rest" && content.blocks.length === 0 ? <RestDayCard/> : content.blocks.length === 0 ? <ContentNotAvailableCard/> : (...)`.

- [ ] **Step 2: White background (A5, solo /today)**

Cambia el `background` del `div` raíz de `var(--rosa-soft)` a `var(--blanco)`. (El header sticky con `rgba(255,255,255,0.94)` queda igual.)

- [ ] **Step 3: Remove day_type badges from DayHeader**

En `DayHeader`, elimina los dos `<span>` de badge condicionados por `dayType === "cardio"` y `dayType === "rest"` (los agregados en Task 1.7). Mantén el tag de `workoutFocus`. El prop `dayType` puede quedar sin uso en `DayHeader`; si genera warning de variable no usada, quítalo de la firma y del call site.

- [ ] **Step 4: Simplify the rest-day ternary (D2)**

Reemplaza el ternario por uno que ya no dependa de `day_type` (la card de descanso solo aplica cuando NO hay fila, lo cual ocurre arriba con `!content`):
```tsx
{content.blocks.length === 0 ? (
  <ContentNotAvailableCard />
) : (
  <>
    <DayHeader
      title={content.day.title}
      workoutFocus={content.day.workout_focus}
      durationMinutes={content.day.duration_minutes}
      dayOfWeek={content.currentDayKey.day_of_week}
    />
    {/* ...resto igual (blocks.map, notas, etc.) */}
  </>
)}
```
(Si quitaste `dayType` de `DayHeader`, no lo pases aquí.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → sin errores. Run: `npx vitest run` → 64 passing (sin regresiones). Run: `npm run build` → OK.

- [ ] **Step 6: Commit**

```bash
git add components/portal/TodayView.tsx
git commit -m "feat: white /today background, drop day-type badges, simplify rest logic (D2)"
```

### Task C4: CardioZone2Block — validar 18–110 + mejor visual

**Files:**
- Modify: `components/portal/blocks/CardioZone2Block.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/portal/blocks/CardioZone2Block.tsx`. Hoy: input de edad numérico; calcula con `cardioZone2(Number(edad))`; muestra el resultado si `suelo`/`cielo` no son null.

- [ ] **Step 2: Add 18–110 validation + a clearer layout**

Agrega validación de rango y un mensaje cuando está fuera de rango; solo muestra el resultado para edades válidas:
```tsx
const edadNum = Number(edad);
const valid = edad !== "" && Number.isFinite(edadNum) && edadNum >= 18 && edadNum <= 110;
const { suelo, cielo } = valid ? cardioZone2(edadNum) : { suelo: null, cielo: null };
```
- Limita el input: `min={18} max={110}`.
- Si `edad !== "" && !valid`, muestra: `<p style={{ color: "var(--error)", fontSize: 13 }} className="mt-2 font-body">Ingresa una edad entre 18 y 110 años.</p>`
- Mantén el texto exacto del resultado: `Tu Cardio zona 2 se encuentra en el rango: {suelo} – {cielo}` (suelo/cielo en `<strong>`).
- Mejora visual: mantén la card con `background: var(--lavanda-tint)`; agrega un poco de jerarquía (ícono HeartPulse + título en `font-head`, ya presentes) y asegura buen espaciado (margen entre input, mensaje y resultado).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → sin errores. Run: `npx vitest run` → 64 passing (la función pura `cardioZone2` no cambia).

- [ ] **Step 4: Commit**

```bash
git add components/portal/blocks/CardioZone2Block.tsx
git commit -m "feat: validate age 18-110 and polish Cardio Zona 2 block"
```

### Task C5: PillarsView — empty-state diseñado

**Files:**
- Modify: `components/portal/PillarsView.tsx`

- [ ] **Step 1: Read the current file**

Lee `components/portal/PillarsView.tsx`. Hoy, cuando `pillars.length === 0`, devuelve un texto centrado simple ("Este mes no tiene pilares adicionales.").

- [ ] **Step 2: Replace with a designed empty state**

Reemplaza ese bloque por una card de empty-state con ícono y mensaje claro (estilo consistente con las cards del portal). Importa `Sparkles` (o `Layers`) de `lucide-react`:
```tsx
if (pillars.length === 0) {
  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="font-head text-2xl mb-4">Pilares del mes</h1>
      <div className="rounded-xl p-8 text-center" style={{ background: "var(--rosa-soft)", border: "1px solid var(--gris-linea)" }}>
        <div className="flex items-center justify-center rounded-full mx-auto mb-4"
          style={{ width: 56, height: 56, background: "rgba(255,255,255,0.7)" }}>
          <Sparkles size={26} color="var(--lavanda-dark)" />
        </div>
        <h2 className="font-head mb-2" style={{ fontSize: 18, fontWeight: 600 }}>
          Este mes no hay pilares adicionales
        </h2>
        <p className="font-body" style={{ color: "var(--gris-texto)", maxWidth: 300, margin: "0 auto" }}>
          Tu enfoque de este mes es la actividad física. Cuando haya contenido extra, aparecerá aquí.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/portal/PillarsView.tsx
git commit -m "feat: designed empty state for /portal/pilares"
```

---

## FASE D — Verificación

### Task D1: Gates completos

- [ ] **Step 1: Tests**

Run: `npx vitest run`
Expected: 64 passing (sin regresiones; esta ronda no agrega tests unitarios — son cambios de UI).

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: limpio; build exitoso.

### Task D2: Re-smoke (asistido por el usuario)

Con `npm run dev`, admin + cliente real con suscripción CuarentaMás (y `stripe listen` corriendo si se prueba checkout):

- [ ] **Editor:** abrir un día → top bar con "Volver a la serie", dropdown Borrador/Publicado junto a Guardar; metadata "Programa de Actividad Física" + Título + Enfoque + Duración; sin selector de tipo. Paleta "Agregar bloque" como botones con ícono.
- [ ] **Texto:** toolbar con B, I, H2, H3, H4, lista (•) y lista ordenada (1.); en el portal las listas muestran viñetas/números y hay espaciado entre encabezados y párrafos.
- [ ] **Imagen:** tras subir, se ve el preview.
- [ ] **Ejercicios:** los 3 campos tienen etiquetas Series / Repeticiones / Descanso (seg).
- [ ] **Grilla:** el menú del día (⋮) se cierra al hacer clic afuera; "Pilares del mes" resalta como botón.
- [ ] **Editor de pilar:** botón "Volver a pilares" + dropdown de estado.
- [ ] **/portal/today:** fondo blanco; sin badge de tipo de día; un día de descanso con contenido se ve como día normal con su Enfoque; un día sin fila muestra la card de descanso.
- [ ] **Calculadora:** edad <18 o >110 muestra mensaje y no calcula; 18–110 muestra el rango.
- [ ] **/portal/pilares:** mes con pilares → acordeón; mes sin pilares → empty-state diseñado.
- [ ] **"Error al guardar":** repetir el flujo de progreso con un cliente con suscripción válida; confirmar que el auto-guardado NO muestra error (si persiste con cliente válido, abrir issue de `upsertProgressLog`).

- [ ] **Step final:** invocar `superpowers:verification-before-completion`; actualizar `handoff.md` (ronda de ajustes completada); luego `superpowers:finishing-a-development-branch` para mergear `feature/fase-2-editor-pilares` a `main`.

---

## Notas
- **No requiere migración nueva.** `day_type` queda en DB sin uso (default `workout`); `saveDay` sigue recibiendo `dayType` pero el editor siempre envía `"workout"`.
- El render de listas/espaciado (A1) es la única dependencia transversal: hacerla primero porque A2 y el smoke de texto dependen de ella.
- Follow-ups previos siguen vigentes (saveBlocks no transaccional, cloneDay/cloneWeek sin test) — no se abordan en esta ronda.
