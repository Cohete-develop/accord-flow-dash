CREATE OR REPLACE FUNCTION public.admin_cascade_delete_company(_company_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_name TEXT;
  _user_ids UUID[];
  _super_admin_ids UUID[];
  _users_to_delete UUID[];
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Solo super_admin';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND company_id = _company_id) THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia empresa';
  END IF;

  IF EXISTS (SELECT 1 FROM public.super_admin_impersonations
             WHERE super_admin_user_id = auth.uid() AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'No puedes eliminar empresas mientras estás impersonando. Sal de la impersonación primero.';
  END IF;

  SELECT name INTO _company_name FROM public.companies WHERE id = _company_id;
  IF _company_name IS NULL THEN
    RAISE EXCEPTION 'Empresa no encontrada';
  END IF;

  SELECT array_agg(user_id) INTO _user_ids
  FROM public.profiles WHERE company_id = _company_id;

  IF _user_ids IS NULL THEN _user_ids := ARRAY[]::UUID[]; END IF;

  SELECT array_agg(user_id) INTO _super_admin_ids
  FROM public.user_roles
  WHERE user_id = ANY(_user_ids) AND role = 'super_admin';

  IF _super_admin_ids IS NULL THEN _super_admin_ids := ARRAY[]::UUID[]; END IF;

  _users_to_delete := ARRAY(SELECT unnest(_user_ids) EXCEPT SELECT unnest(_super_admin_ids));

  DELETE FROM public.kpis WHERE company_id = _company_id;
  DELETE FROM public.entregables WHERE company_id = _company_id;
  DELETE FROM public.pagos WHERE company_id = _company_id;
  DELETE FROM public.acuerdos WHERE company_id = _company_id;

  DELETE FROM public.alert_history WHERE company_id = _company_id;
  DELETE FROM public.campaign_alerts WHERE company_id = _company_id;
  DELETE FROM public.campaign_keywords WHERE company_id = _company_id;
  DELETE FROM public.campaign_metrics WHERE company_id = _company_id;
  DELETE FROM public.campaigns_sync WHERE company_id = _company_id;
  DELETE FROM public.ad_platform_connections WHERE company_id = _company_id;

  DELETE FROM public.product_families WHERE company_id = _company_id;
  DELETE FROM public.content_types WHERE company_id = _company_id;

  DELETE FROM public.invitations WHERE company_id = _company_id;

  IF array_length(_users_to_delete, 1) > 0 THEN
    DELETE FROM public.audit_log WHERE user_id = ANY(_users_to_delete);
    DELETE FROM public.user_roles WHERE user_id = ANY(_users_to_delete);
  END IF;

  INSERT INTO public.audit_log (user_id, user_name, action, module, company_id, details)
  VALUES (
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'super_admin'),
    'delete_company',
    'super_admin',
    NULL,
    jsonb_build_object(
      'company_id', _company_id,
      'company_name', _company_name,
      'deleted_users', COALESCE(array_length(_users_to_delete, 1), 0),
      'preserved_super_admins', COALESCE(array_length(_super_admin_ids, 1), 0)
    )
  );

  IF array_length(_super_admin_ids, 1) > 0 THEN
    UPDATE public.profiles SET company_id = NULL WHERE user_id = ANY(_super_admin_ids);
  END IF;

  IF array_length(_users_to_delete, 1) > 0 THEN
    DELETE FROM public.profiles WHERE user_id = ANY(_users_to_delete);
  END IF;

  DELETE FROM public.companies WHERE id = _company_id;

  _result := jsonb_build_object(
    'success', true,
    'company_name', _company_name,
    'users_to_delete_from_auth', _users_to_delete
  );

  RETURN _result;
END;
$$;