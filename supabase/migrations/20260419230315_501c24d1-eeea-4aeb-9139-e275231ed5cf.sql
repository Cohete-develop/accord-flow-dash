
-- 1. companies.domain NOT NULL
ALTER TABLE public.companies ALTER COLUMN domain SET NOT NULL;

-- 2. Reemplazar policy peligrosa de gerencia sobre companies
DROP POLICY IF EXISTS "Gerencia can manage all companies" ON public.companies;

CREATE POLICY "Gerencia can view own company"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerencia'::app_role)
    AND id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "Gerencia can update own company"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerencia'::app_role)
    AND id = public.get_user_company_id(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'gerencia'::app_role)
    AND id = public.get_user_company_id(auth.uid())
  );

-- 3. audit_log.company_id
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_company ON public.audit_log(company_id);

-- Permitir a gerencia ver auditoría SOLO de su empresa (reemplaza la policy global)
DROP POLICY IF EXISTS "Gerencia can view all audit" ON public.audit_log;

CREATE POLICY "Gerencia can view own company audit"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerencia'::app_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- 4. Documentar trigger handle_new_user
COMMENT ON FUNCTION public.handle_new_user() IS
  'Crea el profile básico al insertarse un usuario en auth.users. La asociación a una empresa (company_id) y la asignación de roles es responsabilidad EXCLUSIVA de las Edge Functions admin-create-user y accept-invite. Si en el futuro se habilita self-signup, este trigger DEBE actualizarse para asignar company_id según el dominio del email.';
