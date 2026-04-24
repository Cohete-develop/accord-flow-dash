-- Renombrar get_active_impersonation_company -> get_active_impersonation
DROP FUNCTION IF EXISTS public.get_active_impersonation_company(uuid);

CREATE OR REPLACE FUNCTION public.get_active_impersonation(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_company_id
  FROM public.super_admin_impersonations
  WHERE super_admin_user_id = _user_id
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1
$$;

-- Actualizar get_user_company_id para usar el nuevo nombre
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE WHEN public.has_role(_user_id, 'super_admin'::app_role)
         THEN public.get_active_impersonation(_user_id)
         ELSE NULL
    END,
    (SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  )
$$;

-- Renombrar stop_impersonation -> end_impersonation y cambiar audit actions
DROP FUNCTION IF EXISTS public.stop_impersonation();

CREATE OR REPLACE FUNCTION public.end_impersonation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Solo super_admin';
  END IF;

  UPDATE public.super_admin_impersonations
  SET ended_at = now()
  WHERE super_admin_user_id = auth.uid() AND ended_at IS NULL
  RETURNING * INTO _row;

  IF _row.id IS NOT NULL THEN
    INSERT INTO public.audit_log(user_id, user_name, action, module, company_id, details)
    VALUES (
      auth.uid(),
      COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'super_admin'),
      'IMPERSONATE_END',
      'super_admin',
      _row.target_company_id,
      jsonb_build_object('impersonation_id', _row.id, 'duration_seconds', EXTRACT(EPOCH FROM (now() - _row.started_at)))
    );
  END IF;
END;
$$;

-- Actualizar start_impersonation para usar la acción IMPERSONATE_START
CREATE OR REPLACE FUNCTION public.start_impersonation(
  _target_company_id uuid,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
  _company_exists boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Solo super_admin puede impersonar';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = _target_company_id AND is_active = true)
    INTO _company_exists;
  IF NOT _company_exists THEN
    RAISE EXCEPTION 'Empresa no existe o está inactiva';
  END IF;

  UPDATE public.super_admin_impersonations
  SET ended_at = now()
  WHERE super_admin_user_id = auth.uid() AND ended_at IS NULL;

  INSERT INTO public.super_admin_impersonations(super_admin_user_id, target_company_id, ip_address, user_agent)
  VALUES (auth.uid(), _target_company_id, _ip, _ua)
  RETURNING id INTO _new_id;

  INSERT INTO public.audit_log(user_id, user_name, action, module, company_id, details)
  VALUES (
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'super_admin'),
    'IMPERSONATE_START',
    'super_admin',
    _target_company_id,
    jsonb_build_object('impersonation_id', _new_id, 'ip', _ip, 'ua', _ua)
  );

  RETURN _new_id;
END;
$$;