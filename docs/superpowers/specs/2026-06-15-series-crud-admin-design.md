# Design: CRUD de Series en Admin de Contenido

**Fecha:** 2026-06-15
**Estado:** Aprobado — pendiente de implementación
**Contexto:** Aura Maristany — Fase 6, bloque de contenido

---

## Problema

El botón "Nueva serie" en `/admin/content/[programId]` existe pero está deshabilitado con el comentario
`"Disponible en Subsistema F — mapeo de variantes"`. No hay forma de crear, editar ni eliminar series
desde la UI. El admin debe poder gestionar el ciclo de vida completo de una serie (mes de contenido)
directamente desde el panel.

---

## Alcance

- Crear una nueva serie para cualquier programa
- Editar título, descripción y estado publicado de una serie existente
- Editar el mapeo de variantes de una serie existente
- Eliminar una serie existente (con advertencia de cascade)

**Fuera de alcance:** reordenar series, arrastrar y soltar, bulk actions.

---

## Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| ¿Variantes mapeadas automáticamente o el admin elige? | El admin elige con checkboxes |
| ¿Número de serie automático o manual? | Manual — el admin lo define |
| ¿UX de editar/eliminar? | Menú "⋯" en header del SeriesAccordion (patrón DayCellMenu) |
| ¿Published al crear? | Siempre arranca como borrador; el toggle solo aparece en modo editar |

---

## Arquitectura

### Nuevos archivos

```
lib/admin/seriesActions.ts          — 3 server actions: createSeries, updateSeries, deleteSeries
components/admin/SeriesFormModal.tsx — modal reutilizable crear/editar
components/admin/SeriesDeleteDialog.tsx — diálogo de confirmación de eliminación
```

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `lib/admin/queries.ts` | `getAdminProgram` también retorna `variants[]` del programa y `variantIds[]` por serie |
| `components/admin/SeriesAccordion.tsx` | Agrega menú "⋯" en header, monta `SeriesFormModal` y `SeriesDeleteDialog` |
| `app/admin/content/[programId]/page.tsx` | Habilita botón "Nueva serie", lo conecta a `SeriesFormModal` en modo create |

---

## Flujos

### Crear serie
1. Admin hace clic en "Nueva serie" (botón en header de la página del programa)
2. Se abre `SeriesFormModal` en modo `create`
3. Admin llena: número de mes, título, descripción (opcional), checkboxes de variantes
4. Submit → `createSeries` server action → `INSERT program_series` (published=false) + `INSERT variant_series_map` por variante seleccionada
5. Si conflicto de número → error inline bajo el campo "Mes #": *"El mes N ya existe en este programa"*
6. Éxito → `revalidatePath` → modal se cierra → lista actualizada

### Editar serie
1. Admin abre menú "⋯" en header del `SeriesAccordion` → selecciona "Editar"
2. Se abre `SeriesFormModal` en modo `edit`, pre-llenado con datos actuales y variantes pre-seleccionadas
3. Campos editables: título, descripción, published (toggle), variantes (checkboxes)
4. El número de mes **no es editable** en modo edit (es la clave de identidad de la serie)
5. Submit → `updateSeries` → `UPDATE program_series` + borra y re-inserta `variant_series_map`
6. Éxito → `revalidatePath` → modal se cierra

### Eliminar serie
1. Admin abre menú "⋯" → selecciona "Eliminar"
2. Se abre `SeriesDeleteDialog` con mensaje:
   *"¿Eliminar Mes X — [título]? Se eliminarán todos los días, bloques y pilares de esta serie. Esta acción no se puede deshacer."*
3. Botones: "Cancelar" y "Eliminar" (en rojo)
4. Confirmar → `deleteSeries` → `DELETE FROM program_series WHERE id = seriesId`
5. CASCADE en DB elimina: `variant_series_map`, `program_days` → `program_day_blocks`, `program_series_pillars` → `program_pillar_blocks`
6. Éxito → `revalidatePath` → lista actualizada

---

## Componentes

### `SeriesFormModal`

```typescript
interface Props {
  programId: string
  variants: { id: string; name: string }[]
  mode: 'create' | 'edit'
  // solo en modo edit:
  series?: {
    id: string
    series_number: number
    title: string
    description: string | null
    published: boolean
    variantIds: string[]
  }
  onClose: () => void
}
```

**Campos:**
- **Mes #** — `<input type="number" min={1}>`, requerido, solo visible en modo create
- **Título** — `<input type="text">`, requerido
- **Descripción** — `<textarea>`, opcional
- **Publicado** — toggle/checkbox, solo visible en modo edit
- **Variantes** — lista de `<input type="checkbox">` con el nombre de cada variante; al menos una requerida

**Validación client-side:** campos requeridos + al menos una variante. Errores del server action se muestran inline.

### `SeriesDeleteDialog`

Diálogo de confirmación simple. Props: `series: { series_number, title }`, `onClose`, `onConfirm`.
Muestra advertencia de cascade y botones Cancelar / Eliminar.

### `SeriesAccordion` — cambios

- Agrega botón "⋯" en el header (entre el badge "borrador" y el chevron)
- Al hacer clic abre dropdown con opciones "Editar" y "Eliminar"
- Necesita recibir también `variants` y `variantIds` como props adicionales
- Monta `SeriesFormModal` (edit) y `SeriesDeleteDialog` con estado local `openModal: 'edit' | 'delete' | null`

---

## Server Actions (`lib/admin/seriesActions.ts`)

Todas requieren `requireAdmin()`. Retornan `{ error?: string }`.

### `createSeries`
```typescript
createSeries(programId: string, data: {
  series_number: number
  title: string
  description?: string
  variantIds: string[]
}): Promise<{ error?: string }>
```
- INSERT en `program_series` (published=false)
- INSERT en `variant_series_map` (N filas)
- Conflicto unique → `{ error: "El mes N ya existe en este programa" }`
- `revalidatePath('/admin/content/' + programId)`

### `updateSeries`
```typescript
updateSeries(seriesId: string, programId: string, data: {
  title: string
  description?: string
  published: boolean
  variantIds: string[]
}): Promise<{ error?: string }>
```
- UPDATE `program_series`
- DELETE + INSERT `variant_series_map` para esa serie
- `revalidatePath('/admin/content/' + programId)`

### `deleteSeries`
```typescript
deleteSeries(seriesId: string, programId: string): Promise<{ error?: string }>
```
- DELETE `program_series WHERE id = seriesId`
- CASCADE en DB hace el resto
- `revalidatePath('/admin/content/' + programId)`

---

## Cambios en queries

`getAdminProgram` pasa de retornar `{ program, series }` a retornar `{ program, series, variants }` donde:

```typescript
variants: { id: string; name: string }[]
```

Y cada elemento de `series` agrega:

```typescript
variantIds: string[]  // IDs de variantes mapeadas a esa serie
```

Esto requiere una segunda query a `variant_series_map` para obtener los mappings, agrupados por `series_id`.

---

## Manejo de errores

| Escenario | Comportamiento |
|---|---|
| Mes # duplicado en create | Error inline bajo el campo "Mes #" |
| Ninguna variante seleccionada | Validación client-side bloquea el submit; si en DB hubiera una serie sin mappings (estado corrupto), el modal de editar no pre-selecciona ninguna y la validación obliga a elegir al menos una antes de guardar |
| Error genérico de DB | Mensaje inline: "Ocurrió un error, intenta de nuevo" |
| Delete de serie inexistente | No falla (DELETE sin filas es silencioso) |

---

## Tests

Archivo: `__tests__/admin/seriesActions.test.ts`

| Test | Descripción |
|---|---|
| `createSeries` — happy path | Inserta serie y mapea variantes correctamente |
| `createSeries` — mes duplicado | Retorna `{ error: "El mes N ya existe..." }` |
| `updateSeries` — actualiza campos | Modifica título, descripción y published |
| `updateSeries` — reconcilia variantes | Borra mappings viejos e inserta los nuevos |
| `deleteSeries` — elimina serie | La serie desaparece de program_series |

No se escriben tests de componentes para los modales (UI pura sin lógica compleja).

---

## Notas de implementación

- El número de serie no es editable en modo edit porque cambiarlo con días existentes rompería la semántica de "Mes N" en el portal del cliente.
- El patron "⋯" sigue exactamente el comportamiento de `DayCellMenu` para mantener consistencia visual.
- `revalidatePath` invalida tanto el Server Component de la página como la cache del Router, por lo que no se necesita `router.refresh()` adicional.
