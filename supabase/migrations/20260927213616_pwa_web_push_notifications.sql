create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
grant all on table public.push_subscriptions to service_role;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id)
  where enabled = true;

create or replace function public.get_web_push_runtime_config()
returns table (
  vapid_public_key text,
  vapid_private_key text,
  webhook_secret text
)
language sql
security definer
set search_path = ''
as $$
  select
    max(decrypted_secret) filter (where name = 'goatbar_vapid_public_key') as vapid_public_key,
    max(decrypted_secret) filter (where name = 'goatbar_vapid_private_key') as vapid_private_key,
    max(decrypted_secret) filter (where name = 'goatbar_push_webhook_secret') as webhook_secret
  from vault.decrypted_secrets
  where name in (
    'goatbar_vapid_public_key',
    'goatbar_vapid_private_key',
    'goatbar_push_webhook_secret'
  );
$$;

revoke all on function public.get_web_push_runtime_config() from public, anon, authenticated;
grant execute on function public.get_web_push_runtime_config() to service_role;

create or replace function public.dispatch_new_budget_web_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook_secret text;
begin
  if coalesce(new.structured_data->>'type', '') <> 'new_budget_request' then
    return new;
  end if;

  select decrypted_secret
    into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'goatbar_push_webhook_secret'
  limit 1;

  if coalesce(v_webhook_secret, '') = '' then
    raise warning '[web-push] webhook secret missing; push skipped for ai_inbox_item %', new.id;
    return new;
  end if;

  perform net.http_post(
    url := 'https://xdqgglrxidmegujhkygj.supabase.co/functions/v1/web-push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-goatbar-push-secret', v_webhook_secret
    ),
    body := jsonb_build_object('record', to_jsonb(new)),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    raise warning '[web-push] dispatch enqueue failed for ai_inbox_item %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.dispatch_new_budget_web_push() from public, anon, authenticated;

drop trigger if exists trg_ai_inbox_new_budget_web_push on public.ai_inbox_items;
create trigger trg_ai_inbox_new_budget_web_push
after insert on public.ai_inbox_items
for each row
when ((new.structured_data->>'type') = 'new_budget_request')
execute function public.dispatch_new_budget_web_push();
