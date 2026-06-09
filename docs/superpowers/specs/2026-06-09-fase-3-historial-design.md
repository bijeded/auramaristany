# Diseño — Fase 3: Historial (`/portal/history`)

**Fecha:** 9 de junio de 2026
**Rama de trabajo:** `feature/fase-3-historial`
**Estado previo:** Fases 0–2 completas y mergeadas a `main` (merge `cc33f89`).
**Fuentes:** SPEC.md §"Historial de Días Anteriores", handoff.md §5D/§5H, prototipo `design-handoff-aura/prototype/aura/client-progress.jsx`, bloque de contexto `docs/superpowers/context/2026-06-09-fase-3-historial.md`.

---

## Resumen del alcance

`/portal/history` ("Mi Progreso") con **2 tabs** (siguiendo el prototipo, no la estructura de 3 tabs del texto del SPEC):

1. **Tab Desempeño** — gráficas de métricas de ejercicio (reps/peso/otras) por ejercicio, del **mes corriente**, con la lista "Historial de ejercicios" debajo.
2. **Tab Fotos** — galería privada de fotos de progreso (subir/ver/borrar), filtrable por mes.

Más una **vista de detalle** `/portal/history/[logId]` (día pasado en modo solo lectura).

### Fuera de alcance (decisiones explícitas del brainstorm)
- **Sin métricas corporales**: peso/cintura/cadera NO se piden ni se registran. La tabla `body_metrics` queda sin captura. Las fotos van independientes (sin vincular a `body_metrics_id`).
- **Sin stat cards** ("Entrenamientos / Días de racha / Reps totales" del prototipo se eliminan).
- **Sin selector de periodo** en las gráficas (solo mes corriente).
- **Sin edición de registros pasados** (P3 del handoff): el detalle es solo lectura.
- **Sin filtro de ángulo** en fotos (el ángulo del prototipo/esquema se reemplaza por un comentario libre; el filtro del grid es por mes).

---

## Sección 1 — Estructura de rutas y navegación

```
/portal/history              → "Mi Progreso", 2 tabs (Desempeño | Fotos)
/portal/history/[logId]      → detalle de un día pasado, solo lectura
```

- `/portal/history/page.tsx`: **server component** que carga datos y monta el client component `ProgressView` (tabs). El ítem de nav inferior "Historial" (`components/portal/PortalNav.tsx`) ya apunta aquí.
- Estado del tab activo: **local en cliente** (el prototipo no lo persiste).
- `/portal/history/[logId]/page.tsx`: **server component**. Valida que el `progress_log` pertenezca a la clienta autenticada (defensa en profundidad además de RLS), carga día + bloques + valores registrados, renderiza en lectura reusando `BlockView`.

---

## Sección 2 — Capa de datos (`lib/content/history.ts`, nuevo, server-only)

Tres funciones, siguiendo el patrón de `getTodayContent` (subscription → `variant_series_map` → serie → `program_days` → bloques → log). Leer `notes` con alias `general_notes:notes` como ya se hace.

**`getHistoryList(userId)`** → filas para "Historial de ejercicios":
- `progress_logs` de la clienta con join a `program_days` (`title`, `workout_focus`, `day_of_week`), ordenado por `log_date desc`.
- Fila: `{ logId, logDate, dayTitle, workoutFocus, doneCount, totalCount }`.
- `doneCount`: ejercicios con `completed:true` en `exercises_done`. `totalCount`: total de ejercicios de los bloques `exercise_list` del día.

**`getPerformanceData(userId)`** → datos de gráficas, **solo mes corriente**:
- "Mes corriente" = `progress_logs` con `log_date >= current_period_start` de la suscripción activa (ancla al ciclo de facturación, consistente con `months_elapsed`).
- Cruza `exercise-uuid` → `name` y `metrics` desde los bloques `exercise_list` de los `program_days` involucrados (el nombre vive en el bloque, no en el log).
- Devuelve por ejercicio: `{ exerciseId, name, metrics: string[], points: [{ date, <metric>: value, ... }] }`.
- **Agregación por día** cuando hay varias series: **peso → promedio de las series del día**; **reps → suma del día**. Otras métricas futuras: promedio por defecto (revisable cuando se definan).

**`getHistoryLog(userId, logId)`** → detalle read-only:
- Carga el `progress_log` validando `profile_id = userId`; su `program_day` + bloques + `exercises_done` + notas.
- Devuelve una estructura tipo `TodayContent` marcada `readonly`, con los valores registrados.

`progress_photos` se consulta aparte (Sección 4).

---

## Sección 3 — Vista de detalle read-only (`/portal/history/[logId]`)

Reusa el máximo del portal actual:

- **Header**: `PortalHeader` con badge "📅 {fecha del log}" (en vez de "HOY"); título + `workout_focus` como tag + duración, igual que `/portal/today`.
- **Bloques** text/youtube/pdf/image/cardio_zone2: vía `BlockView` (ya son read-only).
- **Bloque `exercise_list`** → nuevo componente de presentación **`ExerciseListLogged`** (`components/portal/blocks/`):
  - Recibe `exercises` (del bloque) + `exercises_done` (del log).
  - Por ejercicio: nombre, meta (sets×reps · descanso), y debajo los **valores registrados por serie** (Serie 1: 12 reps · 15 kg, …) como texto **no editable**. Estado de completado como ✓ (no interactivo).
  - Serie/métrica vacía → "—".
- **Notas generales** del día: visibles si existen.
- **Sin** botón de guardar, sin auto-save, sin `useProgressForm`.
- **Integración con `BlockView`**: se le añade un prop opcional `loggedExercises?: Record<string, unknown>`; si viene, los bloques `exercise_list` renderizan `ExerciseListLogged` en vez de `ExerciseListReadOnly`. Así no se duplica el switch de tipos.

---

## Sección 4 — Fotos (storage privado + upload + delete)

**Migración `005_progress_photos.sql`**:
- Bucket **privado** `progress` (no público; el bucket `content` queda intacto).
- Políticas RLS sobre `storage.objects` para el bucket `progress`: la clienta puede `insert`/`select`/`delete` solo bajo su prefijo `{profile_id}/...`; admin ve todo.
- `progress_photos`: `add column caption text`. La columna `angle` queda nullable y sin uso (no se borra para no romper nada).
- Verificar que las políticas `own_or_admin` de `progress_photos` existan en 001; agregar si faltan.
- Path de storage: `progress/{profile_id}/{uuid}.{ext}`.

**Límites (decididos)**:
- Tamaño máx por archivo: **5MB** (límite duro, validado servidor + cliente).
- **Reducción en cliente a 1280px** de lado mayor + recompresión JPEG antes de subir.
- Tope de **30 fotos** por clienta (validado en el servidor: cuenta existentes y rechaza si ≥30).

**Endpoint propio del cliente** `POST /api/portal/photos`:
- No reusa `/api/admin/upload` (admin-gated + bucket público).
- Valida sesión, tipo de imagen, tamaño y tope de 30; sube al bucket privado bajo el prefijo del usuario; inserta `progress_photos` con `photo_date = hoy`, `caption`, `profile_id`.

**Borrar** `DELETE /api/portal/photos/[id]`: valida dueña, borra objeto de Storage + fila.

**Servir**: el server component genera **signed URLs** temporales (`createSignedUrl`, ~1h) por foto al cargar el tab.

**Tab Fotos (UI)**:
- Botón "+ Foto" → selector de archivo / cámara + campo de comentario opcional → comprime → sube.
- **Grid de 3 columnas** de miniaturas con fecha; **filtro por mes** (pills/dropdown de los meses que tienen fotos). Sin filtro de ángulo.
- Visor (lightbox) con navegación ← →, muestra fecha + comentario, y botón **borrar**.
- Empty state cuando no hay fotos.

---

## Sección 5 — Gráficas de Desempeño (Recharts)

- Instalar **recharts**.
- **Selector de ejercicio**: pills horizontales scrollables (uno por ejercicio con datos en el mes). **Sin** selector de periodo.
- **Toggle de métrica dinámico**: según el array `metrics` del ejercicio seleccionado (Peso / Reps, y futuras). Default: primera métrica (peso si existe).
- **Gráfica**: `LineChart` de Recharts, un punto por día registrado, eje X = fecha, tooltip con valor + fecha. Color lavanda `#9982f4`, look cercano al prototipo.
- **Agregación por día**: peso → promedio de las series; reps → suma del día.
- **Pocos datos**: <2 puntos → "Registra al menos 2 entrenamientos para ver tu progreso". Sin logs en el mes → empty state del tab.
- Debajo de la gráfica: lista **"Historial de ejercicios"** (de `getHistoryList`); cada fila clickeable → `/portal/history/[logId]`.

---

## Sección 6 — Migración, dependencias y pruebas

**Dependencia**: `npm install recharts`.

**Migración**: `005_progress_photos.sql` (ver Sección 4).

**Archivos nuevos principales**:
- `lib/content/history.ts` — `getHistoryList`, `getPerformanceData`, `getHistoryLog`.
- `app/portal/history/page.tsx` + `components/portal/ProgressView.tsx`, `PerformanceTab.tsx`, `PhotosTab.tsx`, `PerformanceChart.tsx`.
- `app/portal/history/[logId]/page.tsx` + `components/portal/blocks/ExerciseListLogged.tsx`.
- `app/api/portal/photos/route.ts` (POST), `app/api/portal/photos/[id]/route.ts` (DELETE).
- `lib/portal/photos.ts` (compresión cliente 1280px + helper de signed URLs server).

**Pruebas (TDD donde aplique)**:
- Unit (vitest): agregación de `getPerformanceData` (promedio peso / suma reps, cruce exercise-uuid→nombre); `doneCount/totalCount` de `getHistoryList`; parsing de `exercises_done` en `ExerciseListLogged`.
- Validación de límites de upload (tamaño, tope 30, tipo).
- Gates verdes al cerrar: `vitest`, `tsc`, `npm run build`, lint (como en Fase 2).

**Verificación E2E** (smoke manual con `DEV_DATE`):
- Entrar a `/portal/history`, ver gráfica + "Historial de ejercicios"; abrir un día pasado en lectura.
- Subir foto (con comentario) y borrarla; confirmar filtro por mes.
- Confirmar que la foto NO es accesible por URL público (solo signed URL).

---

## Follow-ups arrastrados (no bloquean Fase 3)
- Configurar Vercel + variables de entorno de producción.
- `stripe.subscriptions.retrieve` sin try/catch.
- `formatDate` duplicado (TodayView / pilares) → unificar en util.
- `saveBlocks`/`savePillarBlocks` delete-then-insert no transaccionales → RPC.
- Tests de `cloneDay`/`cloneWeek`.
