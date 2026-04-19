-- ============================================================
-- 1. AGREGAR CAMPOS A companies
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS max_seats INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- 2. AGREGAR CAMPOS A profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_role TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS member_status TEXT NOT NULL DEFAULT 'active';

-- ============================================================
-- 3. TABLA blocked_domains
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blocked_domains (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view blocked_domains"
  ON public.blocked_domains FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Super admin manages blocked_domains"
  ON public.blocked_domains FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.blocked_domains (domain) VALUES
  ('gmail.com'), ('googlemail.com'), ('hotmail.com'), ('outlook.com'),
  ('yahoo.com'), ('yahoo.es'), ('icloud.com'), ('me.com'),
  ('protonmail.com'), ('proton.me'), ('live.com'), ('msn.com'),
  ('aol.com'), ('mail.com'), ('yandex.com'), ('zoho.com')
ON CONFLICT (domain) DO NOTHING;

-- ============================================================
-- 4. FUNCIÓN HELPER: dominio del email del usuario actual
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_email_domain()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(split_part(email, '@', 2))
  FROM auth.users
  WHERE id = auth.uid()
$$;

-- ============================================================
-- 5. TABLA invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invitations_unique_pending
  ON public.invitations (company_id, lower(email))
  WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);
CREATE INDEX IF NOT EXISTS invitations_company_idx ON public.invitations(company_id);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Trigger: validar que el dominio del email coincida con el de la empresa
CREATE OR REPLACE FUNCTION public.validate_invitation_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_domain TEXT;
  v_email_domain TEXT;
BEGIN
  SELECT lower(domain) INTO v_company_domain
  FROM public.companies WHERE id = NEW.company_id;

  v_email_domain := lower(split_part(NEW.email, '@', 2));

  IF v_company_domain IS NULL THEN
    RAISE EXCEPTION 'La empresa no tiene dominio configurado';
  END IF;

  IF v_email_domain <> v_company_domain THEN
    RAISE EXCEPTION 'El dominio del email (%) no coincide con el de la empresa (%)',
      v_email_domain, v_company_domain;
  END IF;

  NEW.email := lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_invitation_domain ON public.invitations;
CREATE TRIGGER trg_validate_invitation_domain
  BEFORE INSERT OR UPDATE OF email, company_id ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.validate_invitation_domain();

-- RLS para invitations
CREATE POLICY "Super admin full access invitations"
  ON public.invitations FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Gerencia view invitations of company"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerencia')
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "Gerencia create invitations of company"
  ON public.invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'gerencia')
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "Gerencia delete invitations of company"
  ON public.invitations FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerencia')
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "Coordinador view invitations of company"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinador_mercadeo')
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- ============================================================
-- 6. BACKFILL: domain en companies a partir del email del primer 'gerencia'
-- ============================================================
WITH first_gerencia AS (
  SELECT DISTINCT ON (p.company_id)
    p.company_id,
    lower(split_part(u.email, '@', 2)) AS domain
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'gerencia'
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.company_id IS NOT NULL
    AND u.email IS NOT NULL
  ORDER BY p.company_id, p.created_at ASC
)
UPDATE public.companies c
SET domain = fg.domain
FROM first_gerencia fg
WHERE c.id = fg.company_id
  AND c.domain IS NULL
  AND fg.domain NOT IN (SELECT domain FROM public.blocked_domains);

-- Constraint UNIQUE en domain (permite NULL para companies que aún no se hayan resuelto)
CREATE UNIQUE INDEX IF NOT EXISTS companies_domain_unique_idx
  ON public.companies (lower(domain))
  WHERE domain IS NOT NULL;

-- ============================================================
-- 7. BACKFILL: member_role en profiles desde user_roles
-- ============================================================
UPDATE public.profiles p
SET member_role = CASE
  WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'gerencia') THEN 'owner'
  WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'coordinador_mercadeo') THEN 'admin'
  WHEN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role IN ('analista', 'admin_contabilidad')) THEN 'member'
  ELSE 'member'
END,
member_status = CASE WHEN p.is_active THEN 'active' ELSE 'suspended' END;

-- ============================================================
-- 8. TRIGGERS de updated_at en companies (si no existe ya)
-- ============================================================
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
