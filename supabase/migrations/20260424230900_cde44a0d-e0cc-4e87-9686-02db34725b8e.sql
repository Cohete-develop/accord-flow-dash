-- 1) Tabla de impersonaciones
CREATE TABLE public.super_admin_impersonations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

-- Índice único parcial: solo una sesión activa por super_admin
CREATE UNIQUE INDEX uniq_active_impersonation_per_user
  ON public.super_admin_impersonations(super_admin_user_id)
  WHERE ended_at IS NULL;

CREATE INDEX idx_impersonations_company
  ON public.super_admin_impersonations(target_company_id, started_at DESC);

ALTER TABLE public.super_admin_impersonations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin view own impersonations"
  ON public.super_admin_impersonations FOR SELECT TO authenticated
  USING (super_admin_user_id = auth.uid() AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin view all impersonations for audit"
  ON public.super_admin_impersonations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- INSERT/UPDATE/DELETE solo via SECURITY DEFINER RPCs (no policies abiertas)

-- 2) Helper: devuelve la company_id impersonada activamente (o NULL)
CREATE OR REPLACE FUNCTION public.get_active_impersonation_company(_user_id uuid)
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

-- 3) Sustituye get_user_company_id para respetar la impersonación activa
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Si el usuario es super_admin y está impersonando, devuelve la empresa impersonada
    CASE WHEN public.has_role(_user_id, 'super_admin'::app_role)
         THEN public.get_active_impersonation_company(_user_id)
         ELSE NULL
    END,
    -- Caso normal
    (SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  )
$$;

-- 4) RPC: iniciar impersonación
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

  -- Cerrar cualquier sesión activa previa
  UPDATE public.super_admin_impersonations
  SET ended_at = now()
  WHERE super_admin_user_id = auth.uid() AND ended_at IS NULL;

  INSERT INTO public.super_admin_impersonations(super_admin_user_id, target_company_id, ip_address, user_agent)
  VALUES (auth.uid(), _target_company_id, _ip, _ua)
  RETURNING id INTO _new_id;

  -- Audit log
  INSERT INTO public.audit_log(user_id, user_name, action, module, company_id, details)
  VALUES (
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'super_admin'),
    'impersonation_start',
    'super_admin',
    _target_company_id,
    jsonb_build_object('impersonation_id', _new_id, 'ip', _ip, 'ua', _ua)
  );

  RETURN _new_id;
END;
$$;

-- 5) RPC: terminar impersonación activa
CREATE OR REPLACE FUNCTION public.stop_impersonation()
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
      'impersonation_stop',
      'super_admin',
      _row.target_company_id,
      jsonb_build_object('impersonation_id', _row.id, 'duration_seconds', EXTRACT(EPOCH FROM (now() - _row.started_at)))
    );
  END IF;
END;
$$;

-- 6) RPC: obtener sesión activa del caller
CREATE OR REPLACE FUNCTION public.get_my_active_impersonation()
RETURNS TABLE(id uuid, target_company_id uuid, company_name text, started_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.target_company_id, c.name, i.started_at
  FROM public.super_admin_impersonations i
  JOIN public.companies c ON c.id = i.target_company_id
  WHERE i.super_admin_user_id = auth.uid()
    AND i.ended_at IS NULL
  ORDER BY i.started_at DESC
  LIMIT 1
$$;