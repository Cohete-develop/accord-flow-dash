-- ============================================================
-- 1. TABLA platform_domains (dominios reservados para Cohete = super_admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_domains (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view platform_domains"
  ON public.platform_domains FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Super admin manages platform_domains"
  ON public.platform_domains FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.platform_domains (domain) VALUES ('cohete-it.com')
ON CONFLICT (domain) DO NOTHING;

-- ============================================================
-- 2. FUNCIONES HELPER
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_platform_domain(_domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_domains
    WHERE domain = lower(_domain)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_domain(_domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_domains
    WHERE domain = lower(_domain)
  )
$$;

-- ============================================================
-- 3. TRIGGER en companies: validar dominio
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_company_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain TEXT;
BEGIN
  IF NEW.domain IS NULL OR trim(NEW.domain) = '' THEN
    RAISE EXCEPTION 'El dominio corporativo es obligatorio';
  END IF;

  v_domain := lower(trim(NEW.domain));
  NEW.domain := v_domain;

  -- Validación básica de formato (algo.algo)
  IF v_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
    RAISE EXCEPTION 'Formato de dominio inválido: %', v_domain;
  END IF;

  IF public.is_blocked_domain(v_domain) THEN
    RAISE EXCEPTION 'El dominio % es público y no puede usarse para una empresa', v_domain;
  END IF;

  IF public.is_platform_domain(v_domain) THEN
    RAISE EXCEPTION 'El dominio % está reservado para la plataforma', v_domain;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_company_domain ON public.companies;
CREATE TRIGGER trg_validate_company_domain
  BEFORE INSERT OR UPDATE OF domain ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_domain();
