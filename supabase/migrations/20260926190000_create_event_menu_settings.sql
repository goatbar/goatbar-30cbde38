-- Persistent configuration and assets for event menu generation.
create table if not exists public.event_menu_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  artwork_mode text not null default 'automatic'
    check (artwork_mode in ('automatic', 'library', 'ai', 'upload')),
  artwork_url text,
  custom_label text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.event_menu_settings enable row level security;

drop policy if exists "authenticated can read event menu settings" on public.event_menu_settings;
create policy "authenticated can read event menu settings"
  on public.event_menu_settings for select
  to authenticated
  using (true);

drop policy if exists "authenticated can insert event menu settings" on public.event_menu_settings;
create policy "authenticated can insert event menu settings"
  on public.event_menu_settings for insert
  to authenticated
  with check (auth.uid() = updated_by);

drop policy if exists "authenticated can update event menu settings" on public.event_menu_settings;
create policy "authenticated can update event menu settings"
  on public.event_menu_settings for update
  to authenticated
  using (true)
  with check (auth.uid() = updated_by);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-menu-assets',
  'event-menu-assets',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated can upload event menu assets" on storage.objects;
create policy "authenticated can upload event menu assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-menu-assets');

drop policy if exists "authenticated can update event menu assets" on storage.objects;
create policy "authenticated can update event menu assets"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'event-menu-assets')
  with check (bucket_id = 'event-menu-assets');

drop policy if exists "authenticated can delete event menu assets" on storage.objects;
create policy "authenticated can delete event menu assets"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-menu-assets');
