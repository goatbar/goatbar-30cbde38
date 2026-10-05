alter table public.financial_expenses
  add column if not exists personal_reimbursed boolean not null default false,
  add column if not exists personal_reimbursed_at timestamptz;

comment on column public.financial_expenses.personal_reimbursed is
  'Indica se uma despesa paga com recurso pessoal já foi reembolsada pelo Goat Bar.';

comment on column public.financial_expenses.personal_reimbursed_at is
  'Data/hora em que o reembolso pessoal foi marcado como realizado.';
