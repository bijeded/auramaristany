## 1. Migración

- [ ] 1.1 Escribir `supabase/migrations/018_reorder_onboarding_questions.sql`: función `reorder_onboarding_questions(payload jsonb)` que aplica en **un solo** `update ... from jsonb_array_elements(payload)` los pares `{id, sort_order}`. `SECURITY INVOKER` (el default, no escribirlo como definer), `language sql`, `create or replace` para que sea segura de re-aplicar.
- [ ] 1.2 Aplicar la migración con la Management API — **SQL en UNA sola línea** (el pipeline se come los saltos y un `--` autocomenta el resto).
- [ ] 1.3 Verificar contra la base real: llamar a la función con dos ids en orden invertido y leer `sort_order` de vuelta; confirmar que un id inexistente en el payload no altera ninguna fila.

## 2. `reindexOrder` recupera su hogar

- [ ] 2.1 En `lib/admin/onboardingActions.ts`, `reorderQuestions` calcula las posiciones con `reindexOrder(orderedIds)` y las aplica con una sola llamada `.rpc("reorder_onboarding_questions", ...)`, en lugar del bucle de `update`.
- [ ] 2.2 Mantener el contrato de error del action (`{ error }` vía `logAndGeneric`) y `requireAdmin()` + `revalidate()` exactamente como están: esta tarea cambia **cómo se escribe**, no quién puede escribir.
- [ ] 2.3 Test: `reindexOrder` numera desde `0` y de forma consecutiva (fija el comportamiento que el bucle tenía, para que el cambio de escritura no lo mueva).
- [ ] 2.4 Confirmar que ya no queda ninguna derivación de `sort_order` fuera de `reindexOrder` (grep de `sort_order:` en `lib/admin/`).

## 3. Retirar los dos exports huérfanos

- [ ] 3.1 Borrar `subscriptionGrantsPortalShell` de `lib/content/subscription-access.ts` y su bloque en `__tests__/subscription-access.test.ts`. **No tocar** `ACCESS_STATES`, `GRADUATED_STATES`, `PORTAL_SHELL_STATES`, `subscriptionIsGraduated` ni `derivePortalTier`.
- [ ] 3.2 Borrar `isDayAccessible` de `lib/content/access.ts` y su bloque en `__tests__/content-access.test.ts`.
- [ ] 3.3 Añadir en `__tests__/subscription-access.test.ts` la aserción de que `ACCESS_STATES` es exactamente `active`/`trialing`/`past_due` y no incluye `completed` (escenario "The content predicate is never widened"; es la garantía que la reescritura del requisito deja explícita).

## 4. `cancellationReasonLabel` se queda, por escrito

- [ ] 4.1 Comentar en `lib/portal/cancellation.ts` por qué `cancellationReasonLabel` no tiene llamador todavía: la vista de admin sobre `cancellation_surveys` es un cambio aparte y planeado. Sin esta nota, la siguiente limpieza vuelve a proponer borrarlo.

## 5. Verificación

- [ ] 5.1 `npx tsc --noEmit` + `npm run lint` + `npm run test:run` + `npm run build`. El typecheck y el build son lo que atrapa cualquier import residual de los dos símbolos borrados.
- [ ] 5.2 Re-ejecutar el barrido de exports sin llamador en `lib/` y confirmar que sólo queda `cancellationReasonLabel`, ahora con su razón escrita.
- [ ] 5.3 Smoke en `/admin/onboarding-settings`: arrastrar una pregunta a otra posición, recargar y confirmar que el orden persiste; comprobar en la base que las posiciones quedaron consecutivas desde `0`.
- [ ] 5.4 Smoke del portal graduado (regresión del borrado): una cliente `completed` sigue entrando a "Mi cuenta", "Historial" y "Mensajes", y sigue sin poder abrir "Hoy" ni "Semana".

## 6. Cierre

- [ ] 6.1 `openspec validate d18-dead-exports-and-reorder-home`.
- [ ] 6.2 Actualizar `BACKLOG.md`: D18 hecho, y registrar como entrada nueva lo que el barrido dejó abierto (la pregunta del check de CI para exports sin uso, y el mensaje de error de `reorderQuestions` que ahora podría decir "el orden no se guardó").
