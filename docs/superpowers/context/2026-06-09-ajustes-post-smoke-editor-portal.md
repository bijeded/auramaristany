# Contexto — Ajustes post-smoke de Subsistemas E y F (editor + portal)

**Fecha:** 9 de junio de 2026
**Origen:** smoke test manual de Fase 2 (E/F) hecho por Francisco tras aplicar la migración 004.
**Estado del código:** E/F implementados y revisados en la rama `feature/fase-2-editor-pilares` (HEAD `8ec7897`), gates verdes (vitest 64/64, tsc limpio, build OK). **Aún NO mergeado.** Esta ronda de ajustes va sobre esa misma rama, antes de cerrar Fase 2.
**Spec base:** `docs/superpowers/specs/2026-06-08-fase-2-editor-dia-y-pilares-design.md`
**Plan base:** `docs/superpowers/plans/2026-06-08-fase-2-editor-dia-y-pilares.md`
**Referencia de diseño del editor:** `design-handoff-aura/prototype/aura/admin-content.jsx` (layout 2 columnas, pills de tipo, header publicar/borrador, link de regreso `← Serie 1`, panel de vista previa).

---

## Decisiones tomadas (Francisco, 2026-06-09)

- **D1 — Rediseño del editor de día:** SÍ hacer una pasada para acercarlo al prototipo `admin-content.jsx`. **El preview en vivo a la derecha NO se incluye ahora** (no es necesario para el MVP).
- **D2 — Tipo de día:** **Quitar el selector por completo.** Todos los días son "Actividad Física"; el campo **Enfoque** (`workout_focus`) describe la actividad libremente. El **día de descanso tendrá bloques** (Aura crea contenido enfocado al descanso). El `day_type` deja de usarse en UI; la card genérica de descanso solo aparece cuando **no hay fila** `program_days` para hoy.
- **D3 — Guardado de progreso:** el auto-guardado con debounce está bien (sin botón explícito). Verificar el error "Error al guardar. Revisa tu conexión." (ver más abajo).
- **D4 — Checkout/onboarding:** NO es bug. Falta correr el reenvío de webhooks de Stripe en local (ver nota de setup). Documentado, sin cambio de código.
- **A5 (alcance):** fondo blanco solo en `/portal/today`; `/portal/pilares` se queda como está por ahora.

---

## Trabajo a realizar (esta ronda)

### Editor de día — rediseño + correcciones (D1)
Acercar `components/admin/DayEditorForm.tsx` (y `BlockListEditor.tsx`) al prototipo `admin-content.jsx`, **sin** el preview en vivo. Incluye:
- **Layout** más cuidado siguiendo el prototipo (header, espaciados, tipografía Oswald/Hind, tokens).
- **B2 — Botón/Link de regreso** a la grilla del mes (`/admin/content/[programId]`), estilo `← Serie N`.
- **A4 — Estado Publicado/Borrador como dropdown** (hoy es checkbox). El prototipo usa toggle Publicar/Despublicar; Francisco prefiere dropdown Publicado/Borrador.
- **D2 — Quitar el selector de tipo de día.** Etiqueta fija "Programa de Actividad Física"; el descriptor es el campo **Enfoque** (`workout_focus`). No enviar `day_type` desde el editor (queda default `workout` en DB).

### Editor de día — bloques
- **B3 / A2 — Bloque de texto (Tiptap):**
  - Falta **H3** (el spec pedía H2/H3) y se pide también **H4** opcional.
  - La **lista no ordenada (UL) no funciona** → corregir (probable: estilos de lista reseteados por Tailwind/`prose`, o falta render correcto). Verificar tanto el editor como el render en portal (`TextBlock`).
  - Agregar **lista ordenada (OL)**.
- **B4 — Bloque de imagen:** mostrar **preview** de la imagen tras subir (usar la URL pública `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content/${storage_path}`, igual que `PdfBlock`/`ImageBlock`).
- **A3 — Bloque de lista de ejercicios:** etiquetas claras en los 3 campos (Series / Repeticiones / Descanso en seg). Hoy solo hay placeholders.

### Grilla de contenido
- **B1 — Menú del día** (`DayCellMenu`): cerrar al hacer clic afuera (click-outside handler / overlay).
- **A1 — Botón "Pilares del mes":** rediseñar para que sea claro y resalte (hoy es un link tenue).

### Pilares (admin)
- **B5 — Botón de regreso** en el editor de pilar (a `/admin/content/[programId]/series/[seriesId]/pillars` y/o a la grilla).

### Portal `/today`
- **A5 — Fondo blanco** (no rosa) en `/portal/today`. Referencia: `referencias/referencia-hoy.png`. Solo en `/today`.
- **A6 — Espaciado** entre subtítulos (H2/H3) y párrafos en el render de texto (`TextBlock`) para legibilidad.
- **B6 / A7 — Calculadora Cardio Zona 2:** validar edad **18–110** (no permitir fuera de rango); mejorar diseño visual.

### Portal — efecto colateral de D2
- Quitar los badges basados en `day_type` (Descanso / Protocolo Cardiovascular) de `TodayView.DayHeader`; dejar el tag de `workout_focus` (Enfoque) como descriptor.
- Simplificar la lógica de descanso en `TodayView`: si hay fila → renderizar bloques; si no hay fila → card de descanso (el caso `day_type==="rest"` deja de ser el discriminador).
- Quitar el caso del badge de tipo en `BlockRenderer`/`DayHeader` correspondiente. `cardio_zone2` sigue siendo un bloque que Aura agrega; "Protocolo Cardiovascular" pasa a ser un valor de Enfoque + el bloque.

---

## A verificar / investigar
- **D3 — "Error al guardar. Revisa tu conexión." en `/portal/today`:** apareció durante el smoke. Causa probable: la cuenta de prueba se convirtió de admin→cliente directo en la DB y quedó sin `subscription_id`/suscripción válida, por lo que el `upsertProgressLog` falló. Reproducir con un cliente real (con suscripción) antes de tratarlo como bug. Si persiste con cliente válido → es bug del auto-guardado.

## Fuera de scope (follow-up, no en esta ronda)
- **"Nueva serie"** (crear series desde el admin) — nunca estuvo en E/F; otra etapa.
- **Preview en vivo** en el editor (pospuesto por D1).
- `saveBlocks` / `savePillarBlocks` no transaccionales (delete-then-insert) → idealmente RPC con transacción antes de producción.
- `cloneDay` / `cloneWeek` sin test unitario (validados por smoke).
- Server actions de mutación dependen solo de RLS (`is_admin()`), sin check de rol explícito ni mensaje de error limpio.

---

## Nota de setup local — Stripe (D4, importante)

Para probar el flujo de checkout en local, **debe** correr el reenvío de webhooks de Stripe en una terminal aparte:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

El comando imprime un **webhook signing secret** (`whsec_...`) que debe coincidir con `STRIPE_WEBHOOK_SECRET` en `.env.local`. Sin esto, `checkout.session.completed` nunca llega, la suscripción no se crea, y `/portal/activando` hace timeout con "Algo tardó más de lo esperado" (no es bug de código). Aplica incluso en sandbox/test mode.

---

## Cómo continuar
1. Brainstorm/confirmar el alcance visual del rediseño del editor (D1) contra `admin-content.jsx`.
2. Escribir un plan corto (TDD donde aplique) para esta ronda de ajustes.
3. Ejecutar sobre `feature/fase-2-editor-pilares`.
4. Re-correr gates + smoke, luego `finishing-a-development-branch`.

Ver [[fase2-ef-execution]], [[project_aura]], [[feedback_project_approach]].
