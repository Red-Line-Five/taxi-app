-- =========================================================
-- 0005: enable Realtime + speed up reports
-- =========================================================
-- The dashboard and driver pages subscribe with supabase.channel(...)
-- .on('postgres_changes', ...). Supabase only broadcasts changes for
-- tables that are members of the `supabase_realtime` publication, and
-- none of our tables were added to it — so live updates (new trip shows
-- up for the driver, driver goes online on the map, pending driver
-- requests) silently never fired. RLS still applies to what each
-- subscriber receives, so offices and drivers only get their own rows.
--
-- Safe to run more than once.
-- =========================================================

do $$
declare
  t text;
begin
  foreach t in array array['trips', 'office_drivers', 'driver_locations']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Reports filter completed trips by office + completion date.
create index if not exists idx_trips_office_completed
  on trips (office_id, status, completed_at desc);
