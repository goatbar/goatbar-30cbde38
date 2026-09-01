-- Delete a submitted public request atomically, but never cascade-delete real
-- commercial/operational data. The original direct DELETE was also rejected
-- because budget_request_links used ON DELETE SET NULL while its USED-state
-- check requires event_id to remain non-null.
CREATE OR REPLACE FUNCTION public.delete_public_budget_request(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_origin text;
  v_link_id uuid;
  v_fk record;
  v_has_dependency boolean;
  v_dependencies text[] := ARRAY[]::text[];
  v_safe_tables constant text[] := ARRAY[
    'budget_request_links',
    'budget_request_notifications',
    'event_requested_drinks'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'É necessário estar autenticado para excluir uma solicitação.';
  END IF;

  SELECT origin INTO v_origin FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('deleted', true, 'event_deleted', false);
  END IF;

  SELECT id INTO v_link_id FROM public.budget_request_links WHERE event_id = p_event_id;
  IF v_origin <> 'public_budget_form' OR v_link_id IS NULL THEN
    RETURN jsonb_build_object(
      'deleted', false,
      'reason', 'not_public_request',
      'message', 'Este registro não é uma solicitação pública e não pode ser excluído por esta ação.'
    );
  END IF;

  -- Discover every present/future table with a single-column FK to events. This
  -- includes budgets, proposals, contracts, addenda, planning and audit data.
  FOR v_fk IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.events'::regclass
      AND cardinality(con.conkey) = 1
      AND n.nspname = 'public'
      AND NOT (c.relname = ANY(v_safe_tables))
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)',
      v_fk.schema_name, v_fk.table_name, v_fk.column_name)
      INTO v_has_dependency USING p_event_id;
    IF v_has_dependency THEN
      v_dependencies := array_append(v_dependencies, v_fk.table_name);
    END IF;
  END LOOP;

  IF cardinality(v_dependencies) > 0 THEN
    RETURN jsonb_build_object(
      'deleted', false,
      'reason', 'has_dependencies',
      'dependencies', to_jsonb(v_dependencies),
      'message', 'A solicitação possui dados relacionados e não pode ser excluída com segurança: '
        || array_to_string(v_dependencies, ', ') || '.'
    );
  END IF;

  DELETE FROM public.events WHERE id = p_event_id;
  RETURN jsonb_build_object('deleted', true, 'event_deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_public_budget_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_public_budget_request(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.delete_public_budget_request(uuid) IS
  'Safely deletes an unqualified public budget request and its disposable event lifecycle rows.';
