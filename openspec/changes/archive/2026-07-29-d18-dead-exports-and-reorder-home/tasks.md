## 1. Migración

- [x] 1.1 Escribir `supabase/migrations/018_reorder_onboarding_questions.sql`: función `reorder_onboarding_questions(payload jsonb)` que aplica en **un solo** `update ... from jsonb_array_elements(payload)` los pares `{id, sort_order}`. `SECURITY INVOKER` (el default, no escribirlo como definer), `language sql`, `create or replace` para que sea segura de re-aplicar.
- [x] 1.2 Aplicar la migración con la Management API — **SQL en UNA sola línea** (el pipeline se come los saltos y un `--` autocomenta el resto). — **Aplicada** por el humano (no hay token de Management API en este entorno) + `notify pgrst, 'reload schema'`.
- [x] 1.3 Verificar contra la base real: llamar a la función con dos ids en orden invertido y leer `sort_order` de vuelta; confirmar que un id inexistente en el payload no altera ninguna fila. — **Verificada**: dos ids invertidos → `2`, orden persistido; un id inexistente → `orden parcial: 0 de 1`, HTTP 400, **cero filas tocadas**. Igual como `service_role` y como el admin autenticado.

## 2. `reindexOrder` recupera su hogar

- [x] 2.1 En `lib/admin/onboardingActions.ts`, `reorderQuestions` calcula las posiciones con `reindexOrder(orderedIds)` y las aplica con una sola llamada `.rpc("reorder_onboarding_questions", ...)`, en lugar del bucle de `update`.
- [x] 2.2 Mantener el contrato de error del action (`{ error }` vía `logAndGeneric`) y `requireAdmin()` + `revalidate()` exactamente como están: esta tarea cambia **cómo se escribe**, no quién puede escribir.
- [x] 2.3 Test: `reindexOrder` numera desde `0` y de forma consecutiva (fija el comportamiento que el bucle tenía, para que el cambio de escritura no lo mueva). — Ya existía (`asigna sort_order = índice`); no se duplicó.
- [x] 2.4 Confirmar que ya no queda ninguna derivación de `sort_order` fuera de `reindexOrder` (grep de `sort_order:` en `lib/admin/`). — Hecho. `saveQuestion` conserva su `max+1`, que es la regla de **añadir al final**, distinta de la de renumerar; deliberadamente fuera de alcance.
- [x] 2.5 **Añadida en revisión.** `OnboardingBuilder.onDragEnd` tiene que consumir el error: hoy lo descarta, así que un reorden fallido deja pintado el orden optimista y no le dice nada a la admin. Revertir a la lista anterior y mostrar el aviso. Sin esto el contrato de error nuevo no tiene lector — exactamente la enfermedad que D18 viene a curar.

## 3. Retirar los dos exports huérfanos

- [x] 3.1 Borrar `subscriptionGrantsPortalShell` de `lib/content/subscription-access.ts` y su bloque en `__tests__/subscription-access.test.ts`. **No tocar** `ACCESS_STATES`, `GRADUATED_STATES`, `PORTAL_SHELL_STATES`, `subscriptionIsGraduated` ni `derivePortalTier`.
- [x] 3.2 Borrar `isDayAccessible` de `lib/content/access.ts` y su bloque en `__tests__/content-access.test.ts`.
- [x] 3.3 Añadir en `__tests__/subscription-access.test.ts` la aserción de que `ACCESS_STATES` es exactamente `active`/`trialing`/`past_due` y no incluye `completed` (escenario "The content predicate is never widened"; es la garantía que la reescritura del requisito deja explícita). — Ya existían (`ACCESS_STATES es la fuente de verdad` y `completed NO está en ACCESS_STATES`); no se duplicaron.

## 4. `cancellationReasonLabel` se queda, por escrito

- [x] 4.1 Comentar en `lib/portal/cancellation.ts` por qué `cancellationReasonLabel` no tiene llamador todavía: la vista de admin sobre `cancellation_surveys` es un cambio aparte y planeado. Sin esta nota, la siguiente limpieza vuelve a proponer borrarlo.

## 5. Verificación

- [x] 5.1 `npx tsc --noEmit` + `npm run lint` + `npm run test:run` + `npm run build`. El typecheck y el build son lo que atrapa cualquier import residual de los dos símbolos borrados.
- [x] 5.2 Re-ejecutar el barrido de exports sin llamador en `lib/` y confirmar que sólo queda `cancellationReasonLabel`, ahora con su razón escrita. — Hecho: el barrido devuelve **sólo** `cancellationReasonLabel`, ya con su razón escrita.
- [x] 5.3 Smoke en `/admin/onboarding-settings`: arrastrar una pregunta a otra posición, recargar y confirmar que el orden persiste; comprobar en la base que las posiciones quedaron consecutivas desde `0`. — **PASS** tras arreglar el fallo que destapó: el action sacaba `supabase.rpc` a una variable y perdía su receptor (`this.rest` undefined → 500). Cazado con los logs del preview; el fake del test era arrow function y no podía fallar por eso.
- [ ] 5.4 Smoke del portal graduado (regresión del borrado): una cliente `completed` sigue entrando a "Mi cuenta", "Historial" y "Mensajes", y sigue sin poder abrir "Hoy" ni "Semana". — **NO ejecutado.** Ahora mismo no existe ninguna suscripción `completed` en el demo (las de los smokes de L2c se limpiaron), así que habría que fabricar una para probar un no-op: el borrado no tocó ningún lector de la cáscara —`middleware.ts`, `app/portal/layout.tsx` y `account-queries.ts` están intactos— y sólo retiró una función sin llamadores. tsc, build y 631 tests en verde.

## 6. Cierre

- [x] 6.1 `openspec validate d18-dead-exports-and-reorder-home`.
- [x] 6.2 Actualizar `BACKLOG.md`: D18 hecho, y registrar como entrada nueva lo que el barrido dejó abierto (la pregunta del check de CI para exports sin uso, y el mensaje de error de `reorderQuestions` que ahora podría decir "el orden no se guardó"). — Hecho.
