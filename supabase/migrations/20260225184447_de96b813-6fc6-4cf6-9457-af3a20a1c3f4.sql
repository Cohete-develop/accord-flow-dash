
-- Super admin RLS policies for all tables
CREATE POLICY "Super admin can view all companies" ON public.companies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can manage all companies" ON public.companies FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can manage all profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can manage all user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can view all user_roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can view all audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin view all acuerdos" ON public.acuerdos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin view all pagos" ON public.pagos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin view all entregables" ON public.entregables FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin view all kpis" ON public.kpis FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Assign super_admin role to Cohete user
INSERT INTO public.user_roles (user_id, role) VALUES ('de4252c9-e7b6-4a76-a7af-3acdecc7867c', 'super_admin');
