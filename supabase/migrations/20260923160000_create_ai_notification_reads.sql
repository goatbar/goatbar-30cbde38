create table if not exists public.ai_notification_reads (
  ai_inbox_item_id uuid not null references public.ai_inbox_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (ai_inbox_item_id, user_id)
);

alter table public.ai_notification_reads enable row level security;

create policy "Users can read their notification reads"
on public.ai_notification_reads for select to authenticated
using (auth.uid() = user_id);

create policy "Users can mark their own notifications read"
on public.ai_notification_reads for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own notification reads"
on public.ai_notification_reads for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.ai_notification_reads to authenticated;
