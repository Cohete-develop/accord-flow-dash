
-- =============================================
-- FASE 1: Multi-tenancy + Admin structure
-- =============================================

-- 1. Companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  email text NOT NULL DEFAULT '',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('gerencia', 'coordinador_mercadeo', 'admin_contabilidad');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Module permissions table
CREATE TABLE public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT true,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, module)
);
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- 5. Audit log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  module text NOT NULL DEFAULT '',
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 6. Add company_id to existing tables
ALTER TABLE public.acuerdos ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.pagos ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.entregables ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.kpis ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create indexes for company_id
CREATE INDEX idx_acuerdos_company ON public.acuerdos(company_id);
CREATE INDEX idx_pagos_company ON public.pagos(company_id);
CREATE INDEX idx_entregables_company ON public.entregables(company_id);
CREATE INDEX idx_kpis_company ON public.kpis(company_id);
CREATE INDEX idx_profiles_company ON public.profiles(company_id);

-- 7. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- 8. Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', ''))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Companies: gerencia can manage, others can view their own
CREATE POLICY "Gerencia can manage all companies" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia'));

CREATE POLICY "Users can view their own company" ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_user_company_id(auth.uid()));

-- Profiles: users see own profile + same company members
CREATE POLICY "Users can view profiles in their company" ON public.profiles FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Gerencia can manage all profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia'));

-- User roles: gerencia manages, users can view own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Gerencia can manage all roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia'));

-- Module permissions: all authenticated can view
CREATE POLICY "Authenticated can view permissions" ON public.module_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Gerencia can manage permissions" ON public.module_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia'));

-- Audit log: gerencia can view all, users insert own
CREATE POLICY "Gerencia can view all audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia'));

CREATE POLICY "Authenticated can insert audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update existing table policies to include company isolation
-- Drop old policies first
DROP POLICY IF EXISTS "Users can view their own acuerdos" ON public.acuerdos;
DROP POLICY IF EXISTS "Users can insert their own acuerdos" ON public.acuerdos;
DROP POLICY IF EXISTS "Users can update their own acuerdos" ON public.acuerdos;
DROP POLICY IF EXISTS "Users can delete their own acuerdos" ON public.acuerdos;

DROP POLICY IF EXISTS "Users can view their own pagos" ON public.pagos;
DROP POLICY IF EXISTS "Users can insert their own pagos" ON public.pagos;
DROP POLICY IF EXISTS "Users can update their own pagos" ON public.pagos;
DROP POLICY IF EXISTS "Users can delete their own pagos" ON public.pagos;

DROP POLICY IF EXISTS "Users can view their own entregables" ON public.entregables;
DROP POLICY IF EXISTS "Users can insert their own entregables" ON public.entregables;
DROP POLICY IF EXISTS "Users can update their own entregables" ON public.entregables;
DROP POLICY IF EXISTS "Users can delete their own entregables" ON public.entregables;

DROP POLICY IF EXISTS "Users can view their own kpis" ON public.kpis;
DROP POLICY IF EXISTS "Users can insert their own kpis" ON public.kpis;
DROP POLICY IF EXISTS "Users can update their own kpis" ON public.kpis;
DROP POLICY IF EXISTS "Users can delete their own kpis" ON public.kpis;

-- New company-scoped policies for acuerdos
CREATE POLICY "Users view acuerdos by company" ON public.acuerdos FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert acuerdos with company" ON public.acuerdos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update acuerdos by company" ON public.acuerdos FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users delete acuerdos by company" ON public.acuerdos FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- New company-scoped policies for pagos
CREATE POLICY "Users view pagos by company" ON public.pagos FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert pagos with company" ON public.pagos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update pagos by company" ON public.pagos FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users delete pagos by company" ON public.pagos FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- New company-scoped policies for entregables
CREATE POLICY "Users view entregables by company" ON public.entregables FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert entregables with company" ON public.entregables FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update entregables by company" ON public.entregables FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users delete entregables by company" ON public.entregables FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- New company-scoped policies for kpis
CREATE POLICY "Users view kpis by company" ON public.kpis FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert kpis with company" ON public.kpis FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update kpis by company" ON public.kpis FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users delete kpis by company" ON public.kpis FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- 10. Seed default permissions for all roles
INSERT INTO public.module_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  -- Gerencia: full access
  ('gerencia', 'dashboard', true, true, true, true),
  ('gerencia', 'acuerdos', true, true, true, true),
  ('gerencia', 'pagos', true, true, true, true),
  ('gerencia', 'entregables', true, true, true, true),
  ('gerencia', 'kpis', true, true, true, true),
  ('gerencia', 'admin', true, true, true, true),
  -- Coordinador Mercadeo
  ('coordinador_mercadeo', 'dashboard', true, false, false, false),
  ('coordinador_mercadeo', 'acuerdos', true, true, true, false),
  ('coordinador_mercadeo', 'pagos', true, false, false, false),
  ('coordinador_mercadeo', 'entregables', true, true, true, true),
  ('coordinador_mercadeo', 'kpis', true, true, true, false),
  ('coordinador_mercadeo', 'admin', false, false, false, false),
  -- Admin/Contabilidad
  ('admin_contabilidad', 'dashboard', true, false, false, false),
  ('admin_contabilidad', 'acuerdos', true, false, false, false),
  ('admin_contabilidad', 'pagos', true, true, true, true),
  ('admin_contabilidad', 'entregables', true, false, false, false),
  ('admin_contabilidad', 'kpis', true, false, false, false),
  ('admin_contabilidad', 'admin', false, false, false, false);
