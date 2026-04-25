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
  _step TEXT;
  _result jsonb;
BEGIN
  _step := 'check_role';
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Solo super_admin puede ejecutar';
  END IF;

  _step := 'check_self_company';
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid() AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia empresa';
  END IF;

  _step := 'check_impersonation';
  IF EXISTS (
    SELECT 1
    FROM public.super_admin_impersonations
    WHERE super_admin_user_id = auth.uid() AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'No puedes eliminar empresas mientras impersonas. Sal primero.';
  END IF;

  _step := 'fetch_company';
  SELECT name INTO _company_name
  FROM public.companies
  WHERE id = _company_id;

  IF _company_name IS NULL THEN
    RAISE EXCEPTION 'Empresa no encontrada (id=%)', _company_id;
  END IF;

  _step := 'collect_users';
  SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[])
  INTO _user_ids
  FROM public.profiles
  WHERE company_id = _company_id;

  _step := 'separate_super_admins';
  SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[])
  INTO _super_admin_ids
  FROM public.user_roles
  WHERE user_id = ANY(_user_ids) AND role = 'super_admin';

  _users_to_delete := COALESCE(
    ARRAY(SELECT unnest(_user_ids) EXCEPT SELECT unnest(_super_admin_ids)),
    ARRAY[]::UUID[]
  );

  _step := 'delete_kpis';
  DELETE FROM public.kpis WHERE company_id = _company_id;

  _step := 'delete_entregables';
  DELETE FROM public.entregables WHERE company_id = _company_id;

  _step := 'delete_pagos';
  DELETE FROM public.pagos WHERE company_id = _company_id;

  _step := 'delete_acuerdos';
  DELETE FROM public.acuerdos WHERE company_id = _company_id;

  _step := 'delete_alert_history';
  DELETE FROM public.alert_history WHERE company_id = _company_id;

  _step := 'delete_campaign_alerts';
  DELETE FROM public.campaign_alerts WHERE company_id = _company_id;

  _step := 'delete_campaign_keywords';
  DELETE FROM public.campaign_keywords WHERE company_id = _company_id;

  _step := 'delete_campaign_metrics';
  DELETE FROM public.campaign_metrics WHERE company_id = _company_id;

  _step := 'delete_campaigns_sync';
  DELETE FROM public.campaigns_sync WHERE company_id = _company_id;

  _step := 'delete_ad_connections';
  DELETE FROM public.ad_platform_connections WHERE company_id = _company_id;

  _step := 'delete_product_families';
  DELETE FROM public.product_families WHERE company_id = _company_id;

  _step := 'delete_content_types';
  DELETE FROM public.content_types WHERE company_id = _company_id;

  _step := 'delete_invitations';
  DELETE FROM public.invitations WHERE company_id = _company_id;

  _step := 'delete_impersonations';
  DELETE FROM public.super_admin_impersonations WHERE target_company_id = _company_id;

  IF array_length(_user_ids, 1) > 0 THEN
    _step := 'delete_oauth_states';
    DELETE FROM public.oauth_states WHERE user_id = ANY(_user_ids);
  END IF;

  IF array_length(_users_to_delete, 1) > 0 THEN
    _step := 'delete_audit_user';
    DELETE FROM public.audit_log WHERE user_id = ANY(_users_to_delete);

    _step := 'delete_user_roles';
    DELETE FROM public.user_roles WHERE user_id = ANY(_users_to_delete);
  END IF;

  _step := 'insert_audit_action';
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
    _step := 'unlink_super_admins';
    UPDATE public.profiles
    SET company_id = NULL
    WHERE user_id = ANY(_super_admin_ids);
  END IF;

  IF array_length(_users_to_delete, 1) > 0 THEN
    _step := 'delete_profiles';
    DELETE FROM public.profiles WHERE user_id = ANY(_users_to_delete);
  END IF;

  _step := 'delete_company';
  DELETE FROM public.companies WHERE id = _company_id;

  _result := jsonb_build_object(
    'success', true,
    'company_name', _company_name,
    'users_to_delete_from_auth', _users_to_delete
  );

  RETURN _result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error en paso "%" eliminando empresa: %', _step, SQLERRM;
END;
$$;