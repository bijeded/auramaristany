-- ============================================================
-- 007 — ON DELETE CASCADE para borrado total de una clienta.
-- Borrar el auth.user (ya cascadea a profiles) debe limpiar
-- todas las filas dependientes. La mayoría de las FKs a
-- profiles/subscriptions se crearon sin cascade en 001.
-- ============================================================

-- subscriptions -> profiles
alter table subscriptions drop constraint subscriptions_profile_id_fkey;
alter table subscriptions add constraint subscriptions_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;

-- progress_logs -> profiles, subscriptions
alter table progress_logs drop constraint progress_logs_profile_id_fkey;
alter table progress_logs add constraint progress_logs_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;
alter table progress_logs drop constraint progress_logs_subscription_id_fkey;
alter table progress_logs add constraint progress_logs_subscription_id_fkey
  foreign key (subscription_id) references subscriptions(id) on delete cascade;

-- body_metrics -> profiles
alter table body_metrics drop constraint body_metrics_profile_id_fkey;
alter table body_metrics add constraint body_metrics_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;

-- progress_photos -> profiles, body_metrics
alter table progress_photos drop constraint progress_photos_profile_id_fkey;
alter table progress_photos add constraint progress_photos_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;
alter table progress_photos drop constraint progress_photos_body_metrics_id_fkey;
alter table progress_photos add constraint progress_photos_body_metrics_id_fkey
  foreign key (body_metrics_id) references body_metrics(id) on delete cascade;

-- message_recipients -> profiles
alter table message_recipients drop constraint message_recipients_recipient_id_fkey;
alter table message_recipients add constraint message_recipients_recipient_id_fkey
  foreign key (recipient_id) references profiles(id) on delete cascade;

-- invoices -> subscriptions
alter table invoices drop constraint invoices_subscription_id_fkey;
alter table invoices add constraint invoices_subscription_id_fkey
  foreign key (subscription_id) references subscriptions(id) on delete cascade;

-- subscription_events -> subscriptions
alter table subscription_events drop constraint subscription_events_subscription_id_fkey;
alter table subscription_events add constraint subscription_events_subscription_id_fkey
  foreign key (subscription_id) references subscriptions(id) on delete cascade;
