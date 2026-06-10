-- 006_messaging.sql — Fase 4: Mensajería
-- Completa lo que falta en 001 para que las clientas lean sus mensajes
-- y marquen leído. El esquema base (messages, message_recipients) ya existe.

-- 1) SELECT de messages para la destinataria (001 solo tenía messages_admin_write)
create policy "messages_select_recipient_or_admin"
  on messages for select using (
    is_admin() or exists (
      select 1 from message_recipients mr
      where mr.message_id = messages.id
        and mr.recipient_id = auth.uid()
    )
  );

-- 2) UPDATE de message_recipients por la dueña (marcar read_at sin service role)
create policy "message_recipients_own_update"
  on message_recipients for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- 3) Índices para inbox, badge y agregado "leídos de N"
create index if not exists idx_message_recipients_recipient_read
  on message_recipients (recipient_id, read_at);
create index if not exists idx_message_recipients_message
  on message_recipients (message_id);
