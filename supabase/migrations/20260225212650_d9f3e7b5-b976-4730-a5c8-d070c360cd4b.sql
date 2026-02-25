
-- Fix: Change all RLS policies to PERMISSIVE so super_admin OR company-match grants access

-- ============ ACUERDOS ============
DROP POLICY IF EXISTS "Super admin delete all acuerdos" ON public.acuerdos;
DROP POLICY IF EXISTS "Super admin insert acuerdos" ON public.acuerdos;
DROP POLICY IF EXISTS "Super admin update all acuerdos" ON public.acuerdos;
DROP POLICY IF EXISTS "Super admin view all acuerdos" ON public.acuerdos;
DROP POLICY IF EXISTS "Users delete acuerdos by company" ON public.acuerdos;
DROP POLICY IF EXISTS "Users insert acuerdos with company" ON public.acuerdos;
DROP POLICY IF EXISTS "Users update acuerdos by company" ON public.acuerdos;
DROP POLICY IF EXISTS "Users view acuerdos by company" ON public.acuerdos;

CREATE POLICY "Super admin full access acuerdos" ON public.acuerdos FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Users view acuerdos by company" ON public.acuerdos FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert acuerdos with company" ON public.acuerdos FOR INSERT WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update acuerdos by company" ON public.acuerdos FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete acuerdos by company" ON public.acuerdos FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- ============ PAGOS ============
DROP POLICY IF EXISTS "Super admin delete all pagos" ON public.pagos;
DROP POLICY IF EXISTS "Super admin insert pagos" ON public.pagos;
DROP POLICY IF EXISTS "Super admin update all pagos" ON public.pagos;
DROP POLICY IF EXISTS "Super admin view all pagos" ON public.pagos;
DROP POLICY IF EXISTS "Users delete pagos by company" ON public.pagos;
DROP POLICY IF EXISTS "Users insert pagos with company" ON public.pagos;
DROP POLICY IF EXISTS "Users update pagos by company" ON public.pagos;
DROP POLICY IF EXISTS "Users view pagos by company" ON public.pagos;

CREATE POLICY "Super admin full access pagos" ON public.pagos FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Users view pagos by company" ON public.pagos FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert pagos with company" ON public.pagos FOR INSERT WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update pagos by company" ON public.pagos FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete pagos by company" ON public.pagos FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- ============ ENTREGABLES ============
DROP POLICY IF EXISTS "Super admin delete all entregables" ON public.entregables;
DROP POLICY IF EXISTS "Super admin insert entregables" ON public.entregables;
DROP POLICY IF EXISTS "Super admin update all entregables" ON public.entregables;
DROP POLICY IF EXISTS "Super admin view all entregables" ON public.entregables;
DROP POLICY IF EXISTS "Users delete entregables by company" ON public.entregables;
DROP POLICY IF EXISTS "Users insert entregables with company" ON public.entregables;
DROP POLICY IF EXISTS "Users update entregables by company" ON public.entregables;
DROP POLICY IF EXISTS "Users view entregables by company" ON public.entregables;

CREATE POLICY "Super admin full access entregables" ON public.entregables FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Users view entregables by company" ON public.entregables FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert entregables with company" ON public.entregables FOR INSERT WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update entregables by company" ON public.entregables FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete entregables by company" ON public.entregables FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- ============ KPIS ============
DROP POLICY IF EXISTS "Super admin delete all kpis" ON public.kpis;
DROP POLICY IF EXISTS "Super admin insert kpis" ON public.kpis;
DROP POLICY IF EXISTS "Super admin update all kpis" ON public.kpis;
DROP POLICY IF EXISTS "Super admin view all kpis" ON public.kpis;
DROP POLICY IF EXISTS "Users delete kpis by company" ON public.kpis;
DROP POLICY IF EXISTS "Users insert kpis with company" ON public.kpis;
DROP POLICY IF EXISTS "Users update kpis by company" ON public.kpis;
DROP POLICY IF EXISTS "Users view kpis by company" ON public.kpis;

CREATE POLICY "Super admin full access kpis" ON public.kpis FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Users view kpis by company" ON public.kpis FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert kpis with company" ON public.kpis FOR INSERT WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update kpis by company" ON public.kpis FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete kpis by company" ON public.kpis FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Super admin can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;

CREATE POLICY "Super admin full access profiles" ON public.profiles FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Super admin can manage all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can view all user_roles" ON public.user_roles;

CREATE POLICY "Super admin full access user_roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- ============ AUDIT_LOG ============
DROP POLICY IF EXISTS "Super admin can view all audit" ON public.audit_log;

CREATE POLICY "Super admin full access audit" ON public.audit_log FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- ============ COMPANIES ============
DROP POLICY IF EXISTS "Super admin can manage all companies" ON public.companies;
DROP POLICY IF EXISTS "Super admin can view all companies" ON public.companies;

CREATE POLICY "Super admin full access companies" ON public.companies FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
