-- HoneyBadgerAdmin: allow verified admins to maintain activity type metadata.
-- Reading categories remains available under the existing read policy.
alter table public.activity_event_types enable row level security;

grant insert, update on public.activity_event_types to authenticated;

drop policy if exists activity_event_types_admin_insert on public.activity_event_types;
create policy activity_event_types_admin_insert
  on public.activity_event_types
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists activity_event_types_admin_update on public.activity_event_types;
create policy activity_event_types_admin_update
  on public.activity_event_types
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
