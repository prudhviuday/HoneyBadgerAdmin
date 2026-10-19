-- Store canonical physical-place coordinates once per venue.
-- Campaign-specific locations keep their own coordinates so entrances and placements can differ.
alter table public.venues
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.venues'::regclass
      and conname = 'venues_latitude_range_check'
  ) then
    alter table public.venues
      add constraint venues_latitude_range_check
      check (latitude is null or latitude between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.venues'::regclass
      and conname = 'venues_longitude_range_check'
  ) then
    alter table public.venues
      add constraint venues_longitude_range_check
      check (longitude is null or longitude between -180 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.venues'::regclass
      and conname = 'venues_coordinates_paired_check'
  ) then
    alter table public.venues
      add constraint venues_coordinates_paired_check
      check ((latitude is null and longitude is null) or
             (latitude is not null and longitude is not null));
  end if;
end $$;
