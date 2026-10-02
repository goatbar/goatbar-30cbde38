-- Controladoria robusta v2
-- Modalidades, receitas, alocacoes internas, autoria e rastreabilidade.

ALTER TABLE public.financial_expenses
  DROP CONSTRAINT IF EXISTS financial_expenses_modality_check;

UPDATE public.financial_expenses SET modality = '7 Steak House' WHERE modality IN ('Steakhouse','7Steakhouse','7 Steakhouse');
UPDATE public.financial_expenses SET modality = 'Goat Botequim' WHERE modality IN ('Goatbotequim','Goat Botequim');
UPDATE public.financial_expenses SET modality = 'Ativo' WHERE modality = 'Geral';

ALTER TABLE public.financial_expenses
  ADD CONSTRAINT financial_expenses_modality_check
  CHECK (modality IN ('Evento','Goat Botequim','7 Steak House','Degustação','Ativo'));

ALTER TABLE public.financial_expenses
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'Despesa',
  ADD COLUMN IF NOT EXISTS tasting_id uuid REFERENCES public.event_tastings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_payer_name text,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_channel text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS inventory_transfer_id uuid,
  ADD COLUMN IF NOT EXISTS cash_effect boolean NOT NULL DEFAULT true;

ALTER TABLE public.financial_expenses
  DROP CONSTRAINT IF EXISTS financial_expenses_entry_type_check;
ALTER TABLE public.financial_expenses
  ADD CONSTRAINT financial_expenses_entry_type_check
  CHECK (entry_type IN ('Despesa','Receita','Alocação Interna'));

ALTER TABLE public.financial_expenses
  DROP CONSTRAINT IF EXISTS financial_expenses_source_channel_check;
ALTER TABLE public.financial_expenses
  ADD CONSTRAINT financial_expenses_source_channel_check
  CHECK (source_channel IN ('web','gia','system'));

ALTER TABLE public.financial_expenses
  DROP CONSTRAINT IF EXISTS financial_expenses_payment_method_check;

UPDATE public.financial_expenses
SET payment_method = CASE
  WHEN payment_method IN ('PIX','Transferencia','Transferência') THEN 'PIX Goat'
  WHEN payment_method IN ('Cartao','Cartão') THEN 'Cartão de crédito Goat'
  WHEN payment_method IN ('Dinheiro','Outros') THEN 'Pessoal'
  ELSE payment_method
END
WHERE payment_method IS NOT NULL;

UPDATE public.financial_expenses
SET payment_payer_name = COALESCE(NULLIF(payment_payer_name,''), 'Histórico - pagador não informado')
WHERE payment_method = 'Pessoal' AND COALESCE(trim(payment_payer_name),'') = '';

ALTER TABLE public.financial_expenses
  ADD CONSTRAINT financial_expenses_payment_method_check
  CHECK (payment_method IN ('Cartão de crédito Goat','PIX Goat','Pessoal','Interno/Estoque'));

CREATE INDEX IF NOT EXISTS idx_financial_expenses_modality_date
  ON public.financial_expenses (modality, date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_event
  ON public.financial_expenses (event_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_tasting
  ON public.financial_expenses (tasting_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_created_by
  ON public.financial_expenses (created_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_entry_type
  ON public.financial_expenses (entry_type, date DESC);

ALTER TABLE public.financial_expense_items
  ADD COLUMN IF NOT EXISTS inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allocated_quantity numeric(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_quantity numeric(10,3) NOT NULL DEFAULT 0;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_source_check;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS destination_modality text,
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tasting_id uuid REFERENCES public.event_tastings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_cost numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_cost numeric(15,2),
  ADD COLUMN IF NOT EXISTS performed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_expense_item_id uuid REFERENCES public.financial_expense_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financial_entry_id uuid REFERENCES public.financial_expenses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_source_check
  CHECK (source IN ('event','sale','manual','purchase','event_return','internal_allocation'));

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_destination_modality_check
  CHECK (
    destination_modality IS NULL OR
    destination_modality IN ('Evento','Goat Botequim','7 Steak House','Degustação','Ativo')
  );

CREATE INDEX IF NOT EXISTS idx_inventory_movements_destination
  ON public.inventory_movements(destination_modality, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_performed_by
  ON public.inventory_movements(performed_by_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.goatbar_user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goatbar_user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read goatbar profiles" ON public.goatbar_user_profiles;
CREATE POLICY "authenticated read goatbar profiles"
  ON public.goatbar_user_profiles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_financial_expense_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by_user_id := COALESCE(NEW.created_by_user_id, auth.uid());
    NEW.updated_by_user_id := COALESCE(NEW.updated_by_user_id, auth.uid());
  ELSE
    NEW.updated_by_user_id := COALESCE(auth.uid(), NEW.updated_by_user_id);
    NEW.updated_at := now();
  END IF;

  IF NEW.modality = 'Evento' AND NEW.event_id IS NULL THEN
    RAISE EXCEPTION 'Lançamentos da modalidade Evento exigem event_id';
  END IF;

  IF NEW.modality = 'Degustação' AND NEW.event_id IS NULL THEN
    RAISE EXCEPTION 'Lançamentos da modalidade Degustação exigem event_id';
  END IF;

  IF NEW.payment_method = 'Pessoal' AND COALESCE(trim(NEW.payment_payer_name),'') = '' AND NEW.entry_type = 'Despesa' THEN
    RAISE EXCEPTION 'Pagamentos pessoais exigem o nome de quem pagou';
  END IF;

  IF NEW.entry_type = 'Alocação Interna' THEN
    NEW.cash_effect := false;
    NEW.payment_method := 'Interno/Estoque';
    NEW.status := 'Pago';
  END IF;

  IF NEW.source_channel IN ('web','gia') AND NEW.created_by_user_id IS NULL THEN
    RAISE EXCEPTION 'Lançamentos web/GIA exigem usuário autor identificado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_expense_audit_fields ON public.financial_expenses;
CREATE TRIGGER trg_financial_expense_audit_fields
BEFORE INSERT OR UPDATE ON public.financial_expenses
FOR EACH ROW EXECUTE FUNCTION public.set_financial_expense_audit_fields();

CREATE OR REPLACE FUNCTION public.allocate_inventory_cost(
  p_inventory_id uuid,
  p_quantity numeric,
  p_destination_modality text,
  p_event_id uuid DEFAULT NULL,
  p_tasting_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_performed_by_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_inventory public.inventory%ROWTYPE;
  v_total numeric(15,2);
  v_entry_id uuid;
BEGIN
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;
  IF p_destination_modality NOT IN ('Evento','Goat Botequim','7 Steak House','Degustação','Ativo') THEN
    RAISE EXCEPTION 'Modalidade inválida';
  END IF;
  IF p_destination_modality IN ('Evento','Degustação') AND p_event_id IS NULL THEN
    RAISE EXCEPTION 'Evento obrigatório para esta modalidade';
  END IF;

  SELECT * INTO v_inventory FROM public.inventory WHERE id=p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item de estoque não encontrado'; END IF;
  IF v_inventory.quantity < p_quantity THEN RAISE EXCEPTION 'Saldo de estoque insuficiente'; END IF;

  v_total := round((COALESCE(v_inventory.cost_per_unit,0) * p_quantity)::numeric,2);

  INSERT INTO public.financial_expenses(
    date, modality, category, description, amount, responsible,
    payment_method, status, classification, event_id, tasting_id,
    entry_type, cash_effect, created_by_user_id, source_channel
  ) VALUES (
    current_date, p_destination_modality, 'Insumos',
    'Alocação de estoque - ' || v_inventory.name,
    v_total, COALESCE((SELECT display_name FROM public.goatbar_user_profiles WHERE user_id=COALESCE(auth.uid(),p_performed_by_user_id)), 'Usuário Goat Bar'),
    'Interno/Estoque','Pago','Direto',p_event_id,p_tasting_id,
    'Alocação Interna',false,COALESCE(auth.uid(),p_performed_by_user_id),CASE WHEN auth.uid() IS NULL THEN 'gia' ELSE 'web' END
  ) RETURNING id INTO v_entry_id;

  UPDATE public.inventory
  SET quantity=quantity-p_quantity, updated_at=now()
  WHERE id=p_inventory_id;

  INSERT INTO public.inventory_movements(
    inventory_id,type,quantity,source,destination_modality,event_id,tasting_id,
    unit_cost,total_cost,performed_by_user_id,financial_entry_id,notes
  ) VALUES (
    p_inventory_id,'out',p_quantity,'internal_allocation',p_destination_modality,p_event_id,p_tasting_id,
    v_inventory.cost_per_unit,v_total,COALESCE(auth.uid(),p_performed_by_user_id),v_entry_id,p_notes
  );

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_inventory_cost(uuid,numeric,text,uuid,uuid,text,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.allocate_inventory_cost(uuid,numeric,text,uuid,uuid,text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.allocate_inventory_cost(uuid,numeric,text,uuid,uuid,text,uuid) TO authenticated, service_role;


-- Espelha automaticamente compras de Evento na aba Insumos Levados.
ALTER TABLE public.event_planning_items
  ADD COLUMN IF NOT EXISTS inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_planning_source_expense_item
  ON public.event_planning_items(source_expense_item_id)
  WHERE source_expense_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_event_purchase_item_to_planning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_expense public.financial_expenses%ROWTYPE;
BEGIN
  SELECT * INTO v_expense FROM public.financial_expenses WHERE id=NEW.expense_id;
  IF NOT FOUND OR v_expense.modality <> 'Evento' OR v_expense.event_id IS NULL OR v_expense.entry_type <> 'Despesa' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.event_planning_items(
    event_id, source_expense_item_id, inventory_id, item_name, category,
    planned_quantity, unit, estimated_unit_cost, estimated_total_cost, origin, notes
  ) VALUES (
    v_expense.event_id, NEW.id, NEW.inventory_id, NEW.product_name,
    COALESCE(NEW.suggested_category,'Insumos'), NEW.quantity, COALESCE(NEW.unit,'un'),
    COALESCE(NEW.unit_price,0), COALESCE(NEW.total_price,0), 'Comprado para evento',
    'Gerado automaticamente pela Controladoria'
  )
  ON CONFLICT (source_expense_item_id) WHERE source_expense_item_id IS NOT NULL
  DO UPDATE SET
    item_name=EXCLUDED.item_name,
    planned_quantity=EXCLUDED.planned_quantity,
    unit=EXCLUDED.unit,
    estimated_unit_cost=EXCLUDED.estimated_unit_cost,
    estimated_total_cost=EXCLUDED.estimated_total_cost,
    inventory_id=EXCLUDED.inventory_id,
    updated_at=now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_event_purchase_item_to_planning ON public.financial_expense_items;
CREATE TRIGGER trg_sync_event_purchase_item_to_planning
AFTER INSERT OR UPDATE ON public.financial_expense_items
FOR EACH ROW EXECUTE FUNCTION public.sync_event_purchase_item_to_planning();

-- Devolve sobra física de um evento ao estoque preservando o custo original.
CREATE OR REPLACE FUNCTION public.return_event_leftover_to_inventory(
  p_planning_item_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_plan public.event_planning_items%ROWTYPE;
  v_inventory_id uuid;
  v_move_id uuid;
BEGIN
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;
  SELECT * INTO v_plan FROM public.event_planning_items WHERE id=p_planning_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item do evento não encontrado'; END IF;

  v_inventory_id := v_plan.inventory_id;
  IF v_inventory_id IS NULL THEN
    INSERT INTO public.inventory(name,category,quantity,unit,cost_per_unit)
    VALUES (
      v_plan.item_name,
      COALESCE(v_plan.category,'Insumos'),
      0,
      COALESCE(v_plan.unit,'un'),
      COALESCE(v_plan.estimated_unit_cost,0)
    )
    RETURNING id INTO v_inventory_id;

    UPDATE public.event_planning_items SET inventory_id=v_inventory_id WHERE id=v_plan.id;
    UPDATE public.financial_expense_items
      SET inventory_id=v_inventory_id, returned_quantity=COALESCE(returned_quantity,0)+p_quantity
      WHERE id=v_plan.source_expense_item_id;
  ELSE
    UPDATE public.financial_expense_items
      SET returned_quantity=COALESCE(returned_quantity,0)+p_quantity
      WHERE id=v_plan.source_expense_item_id;
  END IF;

  UPDATE public.inventory
  SET quantity=quantity+p_quantity,
      cost_per_unit=CASE WHEN cost_per_unit=0 THEN COALESCE(v_plan.estimated_unit_cost,0) ELSE cost_per_unit END,
      updated_at=now()
  WHERE id=v_inventory_id;

  INSERT INTO public.inventory_movements(
    inventory_id,type,quantity,source,destination_modality,event_id,
    unit_cost,total_cost,performed_by_user_id,source_expense_item_id,notes
  ) VALUES (
    v_inventory_id,'in',p_quantity,'event_return','Ativo',v_plan.event_id,
    COALESCE(v_plan.estimated_unit_cost,0),
    round((COALESCE(v_plan.estimated_unit_cost,0)*p_quantity)::numeric,2),
    auth.uid(),v_plan.source_expense_item_id,p_notes
  ) RETURNING id INTO v_move_id;

  RETURN v_move_id;
END;
$$;

REVOKE ALL ON FUNCTION public.return_event_leftover_to_inventory(uuid,numeric,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.return_event_leftover_to_inventory(uuid,numeric,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.return_event_leftover_to_inventory(uuid,numeric,text) TO authenticated, service_role;


-- Controladoria, estoque e planejamento são módulos internos.
-- Remove políticas legadas abertas a PUBLIC e restringe operações ao usuário autenticado.
ALTER TABLE public.financial_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_planning_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable delete for all" ON public.financial_expenses;
DROP POLICY IF EXISTS "Enable insert for all" ON public.financial_expenses;
DROP POLICY IF EXISTS "Enable read for all" ON public.financial_expenses;
DROP POLICY IF EXISTS "Enable update for all" ON public.financial_expenses;
DROP POLICY IF EXISTS "Enable ALL for authenticated users on financial_expense_items" ON public.financial_expense_items;
DROP POLICY IF EXISTS "public full access inventory" ON public.inventory;
DROP POLICY IF EXISTS "authenticated full access inventory" ON public.inventory;
DROP POLICY IF EXISTS "public full access inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "authenticated full access inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable ALL for authenticated users on event_planning_items" ON public.event_planning_items;

CREATE POLICY "authenticated financial expenses"
  ON public.financial_expenses FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "authenticated financial expense items"
  ON public.financial_expense_items FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "authenticated inventory"
  ON public.inventory FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "authenticated inventory movements"
  ON public.inventory_movements FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "authenticated event planning"
  ON public.event_planning_items FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
