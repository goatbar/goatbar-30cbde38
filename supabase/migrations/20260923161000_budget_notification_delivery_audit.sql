alter table public.budget_request_notifications
  add column if not exists error_category text;

create table if not exists public.budget_request_notification_deliveries (
  notification_id uuid not null references public.budget_request_notifications(id) on delete cascade,
  recipient_phone text not null,
  status text not null check (status in ('SENT', 'FAILED')),
  provider_message_id text,
  error_category text,
  error_message text,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (notification_id, recipient_phone)
);

alter table public.budget_request_notification_deliveries enable row level security;
-- Delivery diagnostics contain phone numbers and are intentionally service-role only.
