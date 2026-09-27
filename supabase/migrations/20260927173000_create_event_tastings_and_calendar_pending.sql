-- Degustações vinculadas a eventos + garantia de pendência do Google Calendar
create table if not exists public.event_tastings (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 status text not null default 'planning' check(status in('planning','scheduled','completed','finalized','cancelled')),
 scheduled_at timestamptz, duration_minutes integer not null default 90 check(duration_minutes between 15 and 480),
 location text, notes text, public_token uuid not null default gen_random_uuid() unique, public_enabled boolean not null default true,
 google_calendar_event_id text, google_calendar_html_link text,
 google_calendar_sync_status text not null default 'not_synced' check(google_calendar_sync_status in('not_synced','pending','synced','error','cancelled')),
 google_calendar_synced_at timestamptz, google_calendar_sync_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.event_tasting_drinks (
 id uuid primary key default gen_random_uuid(), tasting_id uuid not null references public.event_tastings(id) on delete cascade,
 drink_id text not null references public.drinks(id) on delete restrict, display_order integer not null default 0,
 drink_name text not null, drink_description text, drink_image text, selected_for_event boolean not null default false,
 created_at timestamptz not null default now(), unique(tasting_id,drink_id)
);
create table if not exists public.event_tasting_participants (
 id uuid primary key default gen_random_uuid(), tasting_id uuid not null references public.event_tastings(id) on delete cascade,
 slot integer not null check(slot between 1 and 4), name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tasting_id,slot)
);
create table if not exists public.event_tasting_ratings (
 id uuid primary key default gen_random_uuid(), tasting_id uuid not null references public.event_tastings(id) on delete cascade,
 tasting_drink_id uuid not null references public.event_tasting_drinks(id) on delete cascade,
 participant_id uuid not null references public.event_tasting_participants(id) on delete cascade,
 score numeric(3,1) not null check(score between 1 and 10), comment text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tasting_drink_id,participant_id)
);
create index if not exists idx_event_tastings_event on public.event_tastings(event_id,created_at desc);
create index if not exists idx_event_tastings_token on public.event_tastings(public_token);
alter table public.event_tastings enable row level security; alter table public.event_tasting_drinks enable row level security;
alter table public.event_tasting_participants enable row level security; alter table public.event_tasting_ratings enable row level security;
create policy tasting_internal_all on public.event_tastings for all to authenticated using(true) with check(true);
create policy tasting_drinks_internal_all on public.event_tasting_drinks for all to authenticated using(true) with check(true);
create policy tasting_participants_internal_all on public.event_tasting_participants for all to authenticated using(true) with check(true);
create policy tasting_ratings_internal_all on public.event_tasting_ratings for all to authenticated using(true) with check(true);
create or replace function public.touch_event_tasting_updated_at() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=now();return new;end$$;
create trigger trg_touch_event_tastings before update on public.event_tastings for each row execute function public.touch_event_tasting_updated_at();
create trigger trg_touch_event_tasting_participants before update on public.event_tasting_participants for each row execute function public.touch_event_tasting_updated_at();
create trigger trg_touch_event_tasting_ratings before update on public.event_tasting_ratings for each row execute function public.touch_event_tasting_updated_at();
create or replace function public.mark_google_calendar_pending_on_event_change() returns trigger language plpgsql set search_path=public as $$declare s text;begin s:=lower(trim(coalesce(new.status,'')));if s like '%conf%' or s in('proposta_aceita','contrato_assinado','finalizado') then if tg_op='INSERT' or old.status is distinct from new.status or old.date is distinct from new.date or old.event_time is distinct from new.event_time or old.duration_hours is distinct from new.duration_hours or old.event_location is distinct from new.event_location or old.event_name is distinct from new.event_name or old.client_name is distinct from new.client_name then new.google_calendar_sync_status:='pending';new.google_calendar_sync_error:=null;end if;end if;return new;end$$;
create trigger trg_events_calendar_pending before insert or update on public.events for each row execute function public.mark_google_calendar_pending_on_event_change();