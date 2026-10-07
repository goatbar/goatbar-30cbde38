create table if not exists public.first_access_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  failed_attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists first_access_codes_user_active_idx
  on public.first_access_codes(user_id, created_at desc);

alter table public.first_access_codes enable row level security;
revoke all on table public.first_access_codes from anon, authenticated;
