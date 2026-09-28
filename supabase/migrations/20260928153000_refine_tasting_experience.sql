-- Refina o fluxo de degustação: local fixo e quantidade dinâmica de participantes.
update public.event_tastings
set location = 'Base da Goat Bar'
where location is null or btrim(location) = '';

alter table public.event_tastings
  alter column location set default 'Base da Goat Bar',
  alter column location set not null;

alter table public.event_tasting_participants
  drop constraint if exists event_tasting_participants_slot_check;

alter table public.event_tasting_participants
  add constraint event_tasting_participants_slot_check check (slot between 1 and 30);
