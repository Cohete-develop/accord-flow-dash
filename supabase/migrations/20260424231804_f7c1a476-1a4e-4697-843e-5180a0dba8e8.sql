CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _impersonated_company_id UUID;
  _real_company_id UUID;
BEGIN
  IF public.has_role(_user_id, 'super_admin'::app_role) THEN
    SELECT target_company_id INTO _impersonated_company_id
    FROM public.super_admin_impersonations
    WHERE super_admin_user_id = _user_id AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1;

    IF _impersonated_company_id IS NOT NULL THEN
      RETURN _impersonated_company_id;
    END IF;
  END IF;

  SELECT company_id INTO _real_company_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;

  RETURN _real_company_id;
END;
$$;