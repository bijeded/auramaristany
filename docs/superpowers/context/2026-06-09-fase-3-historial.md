# Contexto — Fase 3: Historial (arranque en chat nuevo)

**Fecha:** 9 de junio de 2026
**Estado del proyecto:** Fases 0, 1 y 2 COMPLETAS y mergeadas a `main` (merge `cc33f89`). Esta es la siguiente fase del roadmap.
**Cómo arrancar:** lee este bloque + `SPEC.md` (sección "Historial de Días Anteriores", líneas ~505-533) y el `handoff.md`. Luego haz un **brainstorm** para fijar alcance/decisiones, escribe un **plan** (writing-plans) y ejecútalo (subagent-driven, sobre una rama `feature/fase-3-historial`).

---

## Qué es la Fase 3 (entregable)

`/portal/history` con (según SPEC §Historial + handoff §5H):
1. **Tab "Historial"** — lista cronológica (reciente primero) de días pasados con `progress_log`. Cada fila: fecha, título del día, `workout_focus` como tag, y "N/M ejercicios completados". Click → `/portal/history/[logId]`.
2. **Vista de detalle `/portal/history/[logId]`** — misma estructura visual que `/portal/today` pero **solo lectura**: bloques de contenido normales, lista de ejercicios con los valores registrados (reps/peso/notas) precargados y NO editables, notas del día, badge "📅 {fecha}" en vez de "HOY", sin botón guardar.
3. **Tab "Desempeño"** — gráficas de reps/peso por ejercicio a lo largo del tiempo (Recharts). NO es peso corporal; son métricas de desempeño del entrenamiento.
4. **Métricas corporales + galería de fotos** (tab separado) — la clienta registra peso/cintura/cadera (`body_metrics`) y sube fotos de progreso (`progress_photos`), opcional.

El ítem de nav inferior **"Historial"** ya existe en el portal (`components/portal/PortalNav.tsx`), apuntando a `/portal/history` (ruta aún por crear).

---

## Esquema relevante (ya existe en migración 001 — verificar antes de codificar)

```sql
progress_logs (
  id, profile_id, subscription_id, program_day_id,
  log_date date, completed boolean,
  exercises_done jsonb,   -- estructura por serie (abajo)
  notes text,             -- ⚠ columna 'notes' (NO 'general_notes')
  unique(profile_id, program_day_id)   -- ⚠ sin log_date
)

body_metrics (
  id, profile_id, measured_at date, weight_kg, waist_cm, hip_cm, notes,
  unique(profile_id, measured_at)
)

progress_photos (
  id, profile_id, body_metrics_id, storage_path, photo_date,
  angle text  -- 'front' | 'side' | 'back'
)
```

**`exercises_done` (por serie):**
```json
{ "exercise-uuid": { "completed": true, "series": [{ "reps_done": 12, "weight_kg": 15.0 }, ...] } }
```
N objetos en `series` = N sets. Para las gráficas de Desempeño hay que recorrer todos los `progress_logs` de la clienta y agregar reps/peso por `exercise-uuid` (y el nombre del ejercicio vive en el bloque `exercise_list` del `program_day`, no en el log — cruzar con `program_day_blocks`).

**RLS:** `progress_logs`, `body_metrics`, `progress_photos` tienen política `own_or_admin` (`profile_id = auth.uid() or is_admin()`). Verificar que exista política para `progress_photos` y `body_metrics` (sí existen en 001).

---

## Piezas ya construidas para REUSAR (clave para no reinventar)

- **`components/portal/blocks/BlockView.tsx`** — renderer **read-only** de bloques (text/youtube/pdf/image/cardio_zone2 + `exercise_list` vía `ExerciseListReadOnly`). Ideal para `/portal/history/[logId]`. Para el detalle hay que mostrar además los valores REGISTRADos por ejercicio (reps/peso por serie) — extender o crear una variante de `ExerciseListReadOnly` que reciba el `progress_log.exercises_done` y muestre los valores guardados.
- **`components/portal/ExerciseListReadOnly.tsx`** (en `blocks/`) — lista de ejercicios sin formulario; base para la vista de detalle.
- **`components/portal/PortalHeader.tsx`** — header AURA + fecha (úsalo en las pantallas de historial; toma `dateLabel`).
- **`lib/content/access.ts`** — `getCurrentDayKey` (clamp a semana 4), `isDayAccessible`, `getAccessibleSeries`. Útil para validar qué días pasados son accesibles.
- **`lib/content/queries.ts`** — patrón de `getTodayContent` (subscription → `variant_series_map` → serie → `program_days` → bloques). Fase 3 necesita queries análogas: `getHistoryList(userId)` y `getHistoryLog(userId, logId)` (o por `program_day_id`). Cuidado: leer `notes` con alias `general_notes:notes` como ya se hace.
- **`app/api/admin/upload/route.ts`** — patrón de upload a Storage (bucket público `content`, admin-gated). Para fotos de progreso se necesita un bucket **privado** (solo la dueña/admin leen) con signed URLs — NO reusar el bucket público. Decisión de diseño abajo.
- **`hooks/useProgressForm.ts`** — referencia de cómo se arma `exercises_done` (para parsear en sentido inverso en las gráficas).
- **`DEV_DATE`** sigue disponible para simular fechas en local.

---

## Dependencia a instalar
- **Recharts** (`npm install recharts`) — para las gráficas de Desempeño. Está en el stack del SPEC pero aún NO instalado.

---

## Decisiones / preguntas a resolver en el brainstorm

1. **¿La clienta puede EDITAR un registro pasado** desde `/portal/history/[logId]`? (P3 histórica) — hoy planeado solo lectura. Decidir.
2. **Fotos de progreso (privacidad):** las fotos son personales → bucket **privado** + signed URLs (a diferencia del bucket `content` que es público). Definir bucket (`progress`?), policies RLS de Storage, y endpoint de upload propio del cliente (no el de admin).
3. **Métricas corporales — UI de captura:** ¿pantalla/tab aparte para registrar peso/cintura/cadera? ¿con qué cadencia? ¿se vinculan fotos a una medición (`body_metrics_id`)?
4. **Gráficas de Desempeño:** ¿selector de ejercicio (dropdown)? ¿qué se grafica (reps, peso, o ambos)? ¿rango de fechas? ¿cómo manejar ejercicios que aparecen en varios días?
5. **Acceso a días pasados:** mostrar contenido aunque no haya `progress_log` (la clienta pudo entrar y no guardar) — el SPEC lo pide; definir la query de "días accesibles ya transcurridos".
6. **Estructura de `/portal/history`:** ¿tabs en una sola ruta, o subrutas? El SPEC habla de tabs (Historial / Desempeño / Métricas+Fotos).

---

## Verificación al cerrar Fase 3 (del SPEC §Verificación E2E)
- Punto 9: entrar a `/portal/history`, seleccionar un día pasado → ver contenido + registro en lectura.
- Gráficas de desempeño muestran reps/peso correctos por ejercicio.
- Fotos privadas: solo la dueña (y admin) las ven.

---

## Follow-ups arrastrados (de Fase 2 — atacar cuando convenga, no bloquean Fase 3)
- Configurar **Vercel** + variables de entorno de producción.
- `stripe.subscriptions.retrieve` sin try/catch (paid-but-no-row).
- `formatDate` duplicado en `TodayView` y `app/portal/pilares/page.tsx` → unificar en util.
- `saveBlocks`/`savePillarBlocks` delete-then-insert NO transaccionales → RPC con transacción.
- `cloneDay`/`cloneWeek` sin test unitario.
- Alinear cualquier otra divergencia SPEC ↔ migración (ya se corrigió `notes`/unique de `progress_logs`).
- Setup local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` para checkout.

Ver [[project-aura-maristany]], [[fase2-ef-execution]], [[feedback_project_approach]].
