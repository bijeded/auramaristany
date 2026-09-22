/* ============================================================
   023 — Registro de la factura y avance de la suscripción en una sola
   transacción (D16)

   En una renovación, `handleInvoicePaid` registraba la factura y después
   avanzaba `months_elapsed` y el puntero de contenido en dos llamadas
   PostgREST, cada una con su propio commit. La guarda de idempotencia es "la
   factura se registró ahora", así que cualquier fallo entre las dos (un
   error de la escritura, una guarda optimista perdida contra otra factura de
   la misma suscripción, un corte) perdía el mes para siempre: cada reintento
   de Stripe encontraba la factura ya registrada y se detenía en la guarda.

   `record_invoice_and_advance` hace las dos escrituras en una sola llamada,
   es decir, en una sola transacción. Si la factura ya estaba registrada no
   toca nada y devuelve false (redelivery). Si el avance no se puede aplicar
   levanta, y eso deshace también el insert de la factura: el reintento de
   Stripe vuelve a procesarla desde el estado actual.

   Igual que 021 y 022, NO decide nada: el avance (mes, completion, puntero)
   lo calcula el handler con la lógica ya probada y aquí sólo se aplica bajo
   la misma guarda optimista (`months_elapsed`, `content_ordinal`). Dos
   defensas propias: el mes sólo puede avanzar exactamente uno, y la terna
   del puntero va entera o no va.

   SECURITY INVOKER y EXECUTE sólo para `service_role`, el único que llama
   (el webhook). Se quita EXECUTE también a anon y authenticated de forma
   explícita: los privilegios por defecto de Supabase se lo conceden a las
   funciones nuevas de `public`, así que quitárselo a public no basta.

   Comentarios en bloque, sin guiones dobles: la Management API recibe el SQL
   en UNA sola línea. Tras aplicarla: notify pgrst, 'reload schema'.
   ============================================================ */

create or replace function record_invoice_and_advance(
  p_subscription_id uuid,
  p_stripe_invoice_id text,
  p_amount_paid numeric,
  p_currency text,
  p_status text,
  p_invoice_date date,
  p_expected_months_elapsed int,
  p_expected_content_ordinal int,
  p_months_elapsed int,
  p_complete boolean,
  p_content_variant_id uuid,
  p_content_ordinal int,
  p_content_loops int
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  inserted int;
  touched int;
  has_position boolean;
begin
  if p_months_elapsed is distinct from p_expected_months_elapsed + 1 then
    raise exception 'el mes sólo avanza de uno en uno: % tras %', p_months_elapsed, p_expected_months_elapsed
      using errcode = 'data_exception';
  end if;

  has_position := p_content_variant_id is not null;
  if (p_content_ordinal is not null) <> has_position or (p_content_loops is not null) <> has_position then
    raise exception 'posición de contenido incompleta' using errcode = 'data_exception';
  end if;

  insert into invoices (subscription_id, stripe_invoice_id, amount_paid, currency, status, invoice_date)
  values (p_subscription_id, p_stripe_invoice_id, p_amount_paid, p_currency, p_status, p_invoice_date)
  on conflict (stripe_invoice_id) do nothing;

  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;

  update subscriptions
     set months_elapsed = p_months_elapsed,
         completed_at = case when p_complete then now() else completed_at end,
         cancel_at_period_end = case when p_complete then true else cancel_at_period_end end,
         content_variant_id = case when has_position then p_content_variant_id else content_variant_id end,
         content_ordinal = case when has_position then p_content_ordinal else content_ordinal end,
         content_loops = case when has_position then p_content_loops else content_loops end
   where id = p_subscription_id
     and months_elapsed = p_expected_months_elapsed
     and content_ordinal = p_expected_content_ordinal;

  get diagnostics touched = row_count;
  if touched <> 1 then
    raise exception 'avance no aplicado: la suscripción % cambió desde que se leyó', p_subscription_id
      using errcode = 'serialization_failure';
  end if;

  return true;
end;
$$;

comment on function record_invoice_and_advance(uuid, text, numeric, text, text, date, int, int, int, boolean, uuid, int, int) is
  'Registra una factura de renovación y avanza la suscripción en una sola transacción. false = factura ya registrada, nada cambia. Levanta (y deshace la factura) si la fila cambió desde que se leyó. SECURITY INVOKER, sólo service_role.';

revoke execute on function record_invoice_and_advance(uuid, text, numeric, text, text, date, int, int, int, boolean, uuid, int, int) from public, anon, authenticated;
grant execute on function record_invoice_and_advance(uuid, text, numeric, text, text, date, int, int, int, boolean, uuid, int, int) to service_role;
