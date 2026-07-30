-- 019_cancellation_reason_prefer_not_to_say.sql
-- D19 — "Prefiero no decir" deja de guardarse como "Otro".
--
-- El modal de baja siempre ofreció "Prefiero no decir", pero la base no tenía
-- ese valor, así que `cancelSubscription` escribía `reason ?? 'otro'`. Quien
-- prefería no contestar y quien contestaba "Otro" acababan en la misma fila, y
-- después no había forma de separarlas.
--
-- Daba igual mientras nadie leyera la columna. Ya no: la tarjeta "Razones de
-- cancelación" del dashboard pinta esa barra, y ahí dentro van dos poblaciones
-- que piden respuestas opuestas —un motivo que la lista no cubre, y una
-- clienta que decidió no darlo—.
--
-- OJO al orden: esta migración va ANTES que el código que nombra el valor. Al
-- revés, el CHECK rechaza el insert y `cancelSubscription` se traga ese error a
-- propósito (Stripe corre primero y la encuesta es telemetría best-effort, para
-- que un fallo aquí no deje una baja huérfana). O sea que la fila se pierde EN
-- SILENCIO: ni la clienta, ni Aura, ni CI ven nada.
--
-- El CHECK original es inline en el `create table` de la 011, así que Postgres
-- le puso el nombre por defecto `cancellation_surveys_reason_check`. VERIFICAR
-- ese nombre contra la base antes de aplicar:
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'cancellation_surveys'::regclass and contype = 'c';
--
-- Si el nombre no coincide, el `drop ... if exists` es un no-op y el `add` crea
-- un SEGUNDO check: los dos quedan vigentes, el viejo sigue rechazando el valor
-- nuevo, y todo parece haber funcionado. Ése es el único modo de fallo de esta
-- migración, y es callado.

alter table cancellation_surveys drop constraint if exists cancellation_surveys_reason_check;

alter table cancellation_surveys add constraint cancellation_surveys_reason_check check (reason in ('precio_muy_caro', 'no_tengo_tiempo', 'no_logre_objetivo', 'no_veo_resultados', 'encontre_otra_opcion', 'otro', 'prefiero_no_decir', 'pago_fallido'));

-- La política de insert de la 011 no se toca: su `with check` sólo exige
-- `profile_id = auth.uid()`, `source = 'voluntary'` y `reason <> 'pago_fallido'`,
-- y `prefiero_no_decir` pasa las tres sin cambios.
--
-- Tampoco hay backfill, y no es un olvido: las filas viejas guardadas como
-- 'otro' que en realidad eran "prefiero no decir" son INDISTINGUIBLES — la
-- información se destruyó al escribirlas. La barra "Otro" del dashboard queda
-- contaminada para siempre en lo ya escrito; sólo las bajas posteriores a este
-- cambio son limpias.
