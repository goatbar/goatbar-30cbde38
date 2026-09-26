create table if not exists public.document_share_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  event_id uuid null references public.events(id) on delete cascade,
  document_kind text not null check (document_kind in ('menu','contract','proposal')),
  bucket_id text not null,
  object_path text not null,
  filename text null,
  mime_type text not null default 'application/pdf',
  expires_at timestamptz not null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz null
);

create index if not exists document_share_links_expires_at_idx
  on public.document_share_links (expires_at);

create index if not exists document_share_links_event_id_idx
  on public.document_share_links (event_id, document_kind, created_at desc);

alter table public.document_share_links enable row level security;
