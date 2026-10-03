-- Allow photo-based purchases to be saved without inventing a payment method.
-- Manual entries can still require an explicit payment method at the application layer.
alter table public.financial_expenses
  drop constraint if exists financial_expenses_payment_method_check;

alter table public.financial_expenses
  add constraint financial_expenses_payment_method_check
  check (
    payment_method = any (
      array[
        'Cartão de crédito Goat'::text,
        'PIX Goat'::text,
        'Pessoal'::text,
        'Interno/Estoque'::text,
        'Não informado'::text
      ]
    )
  );
