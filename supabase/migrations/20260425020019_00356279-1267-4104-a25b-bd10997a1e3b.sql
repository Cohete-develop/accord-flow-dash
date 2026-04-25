-- Helper: super_admin que NO está impersonando (bypass total)
CREATE OR REPLACE FUNCTION public.is_super_admin_no_impersonation(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::app_role)
    AND NOT EXISTS (
      SELECT 1 FROM public.super_admin_impersonations
      WHERE super_admin_user_id = _user_id AND ended_at IS NULL
    )
$$;

-- profiles
DROP POLICY IF EXISTS "Super admin full access profiles" ON public.profiles;
CREATE POLICY "Super admin full access profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin impersonating sees tenant profiles" ON public.profiles;
CREATE POLICY "Super admin impersonating sees tenant profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- acuerdos / pagos / entregables / kpis
DROP POLICY IF EXISTS "Super admin full access acuerdos" ON public.acuerdos;
CREATE POLICY "Super admin full access acuerdos" ON public.acuerdos
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access pagos" ON public.pagos;
CREATE POLICY "Super admin full access pagos" ON public.pagos
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access entregables" ON public.entregables;
CREATE POLICY "Super admin full access entregables" ON public.entregables
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access kpis" ON public.kpis;
CREATE POLICY "Super admin full access kpis" ON public.kpis
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

-- companies
DROP POLICY IF EXISTS "Super admin full access companies" ON public.companies;
CREATE POLICY "Super admin full access companies" ON public.companies
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin impersonating sees own tenant company" ON public.companies;
CREATE POLICY "Super admin impersonating sees own tenant company" ON public.companies
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    AND id = public.get_user_company_id(auth.uid())
  );

-- user_roles
DROP POLICY IF EXISTS "Super admin full access user_roles" ON public.user_roles;
CREATE POLICY "Super admin full access user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin impersonating sees tenant user_roles" ON public.user_roles;
CREATE POLICY "Super admin impersonating sees tenant user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    AND user_id IN (
      SELECT user_id FROM public.profiles
      WHERE company_id = public.get_user_company_id(auth.uid())
    )
  );

-- audit_log
DROP POLICY IF EXISTS "Super admin full access audit" ON public.audit_log;
CREATE POLICY "Super admin full access audit" ON public.audit_log
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin impersonating sees tenant audit" ON public.audit_log;
CREATE POLICY "Super admin impersonating sees tenant audit" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- invitations
DROP POLICY IF EXISTS "Super admin full access invitations" ON public.invitations;
CREATE POLICY "Super admin full access invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

-- product_families / content_types
DROP POLICY IF EXISTS "Super admin full access product_families" ON public.product_families;
CREATE POLICY "Super admin full access product_families" ON public.product_families
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access content_types" ON public.content_types;
CREATE POLICY "Super admin full access content_types" ON public.content_types
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

-- Campaign Monitor
DROP POLICY IF EXISTS "Super admin full access ad_platform_connections" ON public.ad_platform_connections;
CREATE POLICY "Super admin full access ad_platform_connections" ON public.ad_platform_connections
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access campaigns_sync" ON public.campaigns_sync;
CREATE POLICY "Super admin full access campaigns_sync" ON public.campaigns_sync
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access campaign_metrics" ON public.campaign_metrics;
CREATE POLICY "Super admin full access campaign_metrics" ON public.campaign_metrics
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access campaign_keywords" ON public.campaign_keywords;
CREATE POLICY "Super admin full access campaign_keywords" ON public.campaign_keywords
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access campaign_alerts" ON public.campaign_alerts;
CREATE POLICY "Super admin full access campaign_alerts" ON public.campaign_alerts
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access alert_history" ON public.alert_history;
CREATE POLICY "Super admin full access alert_history" ON public.alert_history
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));

-- oauth_states
DROP POLICY IF EXISTS "Super admin full access oauth_states" ON public.oauth_states;
CREATE POLICY "Super admin full access oauth_states" ON public.oauth_states
  FOR ALL TO authenticated
  USING (public.is_super_admin_no_impersonation(auth.uid()))
  WITH CHECK (public.is_super_admin_no_impersonation(auth.uid()));