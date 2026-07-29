-- 017_rolling_billing_extra.sql
-- L2c — CuarentaMás Extra se cobra como lo que se vende, y un plazo fijo puede
-- por fin terminar de verdad.
--
-- Tres cosas, las tres de datos o de constraints:
--
--   1. `cuarenta-mas-extra` pasa a `rolling_monthly`. Se sembró como plazo fijo
--      de 6 meses, pero se vende como suscripción mensual abierta: la cliente
--      termina CuarentaMás, se suscribe a Extra en el nivel que le toca y sigue
--      mientras quiera. Sólo se había corregido la etiqueta del admin.
--
--   2. El CHECK de `subscriptions.status` acepta `completed` y `trialing`. Los
--      dos están en `SubscriptionStatus` desde siempre y ninguno se podía
--      escribir: por eso la ruta de completion nunca pudo funcionar, ni aunque
--      lo hubiera intentado. Regla del proyecto: el enum de la app y el CHECK
--      que lo refleja se migran juntos.
--
--   3. Se borran los prerequisitos de las variantes de Extra. Codifican una
--      regla de CONTENIDO ("Extra va después de CuarentaMás") mientras Aura
--      aplica una de JUICIO ("la evalué y está lista para Avanzado") y manda
--      desde su sitio al checkout de ese nivel. No se reconcilian: la regla de
--      la base rechaza justo a las clientes que ella aprobó. La puerta se mueve
--      al embudo.

begin;

-- 1 · Extra deja de tener final
update programs
   set billing_model = 'rolling_monthly',
       duration_months = null
 where slug = 'cuarenta-mas-extra';

-- 2 · el CHECK se reemplaza entero (no se edita en sitio). Va dentro de la
--     transacción: entre el drop y el add no puede existir una ventana con la
--     columna sin restringir.
--
--     Se incluyen además los estados intermedios que Stripe puede espejar
--     (`incomplete`, `incomplete_expired`, `paused`). `handleSubscriptionUpdated`
--     los escribe tal cual desde el evento, y hasta ahora el CHECK los
--     rechazaba en silencio: la fila se quedaba como estaba y seguía sirviendo
--     contenido de una suscripción que Stripe ya daba por muerta.
alter table subscriptions drop constraint if exists subscriptions_status_check;
alter table subscriptions add constraint subscriptions_status_check
  check (status in ('active','trialing','past_due','canceled','unpaid','completed','incomplete','incomplete_expired','paused'));

-- 3 · `with check` explícito en la política de escritura de admin. Sin él
--     Postgres cae en la expresión de USING, que funciona pero es implícita —y
--     este cambio convierte `status` y `completed_at` en columnas que sostienen
--     el acceso.
drop policy if exists subscriptions_admin_write on subscriptions;
create policy subscriptions_admin_write on subscriptions
  for all using (is_admin()) with check (is_admin());

-- 4 · se limpia cualquier `completed_at` huérfano. L2b lo escribía al llegar al
--     último mes SIN cancelar nada en Stripe, así que una fila así no significa
--     "esto va a terminar": significa que se contó mal. A partir de aquí las dos
--     señales van juntas, y una marca vieja sin cancelación programada haría que
--     el portal le dijera a una cliente que sigue pagando que no se le cobrará.
--     Hoy en producción no hay ninguna (verificado); queda como red.
update subscriptions
   set completed_at = null
 where completed_at is not null
   and cancel_at_period_end = false;

-- 5 · fuera la puerta de prerequisitos de Extra
delete from program_variant_prerequisites
 where program_variant_id in (
   select id from program_variants
    where program_id = (select id from programs where slug = 'cuarenta-mas-extra')
 );

commit;
