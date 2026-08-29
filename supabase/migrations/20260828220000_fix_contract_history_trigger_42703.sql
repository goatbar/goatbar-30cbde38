-- Migration: Correção Definitiva do Trigger de Histórico de Contrato (PostgreSQL Error 42703)
-- Causa: O trigger em public.event_contracts tentava inserir em public.contract_history na coluna inexistente "contract_id"
-- Solução: Assegurar que a coluna canônica "event_contract_id" seja utilizada em todas as funções de trigger.

BEGIN;

-- 1. Cria ou substitui public.log_event_contract_history() usando event_contract_id
CREATE OR REPLACE FUNCTION public.log_event_contract_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.contract_history (
    event_contract_id,
    action,
    previous_data,
    new_data,
    created_at
  )
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Também atualiza public.log_contract_history() para que qualquer chamada legada não quebre
CREATE OR REPLACE FUNCTION public.log_contract_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.contract_history (
    event_contract_id,
    action,
    previous_data,
    new_data,
    created_at
  )
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Limpeza de triggers obsoletos e re-amarração limpa em public.event_contracts
DROP TRIGGER IF EXISTS trigger_event_contract_history ON public.event_contracts;
DROP TRIGGER IF EXISTS log_event_contract_history_trigger ON public.event_contracts;
DROP TRIGGER IF EXISTS trg_event_contracts_history ON public.event_contracts;
DROP TRIGGER IF EXISTS trg_log_contract_history ON public.event_contracts;
DROP TRIGGER IF EXISTS on_event_contract_change ON public.event_contracts;
DROP TRIGGER IF EXISTS event_contracts_history_trg ON public.event_contracts;

CREATE TRIGGER trigger_event_contract_history
AFTER INSERT OR UPDATE OR DELETE ON public.event_contracts
FOR EACH ROW EXECUTE FUNCTION public.log_event_contract_history();

COMMIT;
