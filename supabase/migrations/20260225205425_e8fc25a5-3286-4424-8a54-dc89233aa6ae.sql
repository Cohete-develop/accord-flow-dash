
-- Drop existing gerencia policies on user_roles that need updating
DROP POLICY IF EXISTS "Gerencia can insert company roles" ON public.user_roles;
DROP POLICY IF EXISTS "Gerencia can update company roles" ON public.user_roles;
DROP POLICY IF EXISTS "Gerencia can delete company roles" ON public.user_roles;

-- Gerencia can insert any non-super_admin role in their company
CREATE POLICY "Gerencia can insert company roles"
ON public.user_roles FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'gerencia'::app_role)
  AND role <> 'super_admin'::app_role
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Gerencia can update any non-protected user roles in their company
CREATE POLICY "Gerencia can update company roles"
ON public.user_roles FOR UPDATE
USING (
  has_role(auth.uid(), 'gerencia'::app_role)
  AND NOT is_protected_user(user_id)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Gerencia can delete any non-protected user roles in their company
CREATE POLICY "Gerencia can delete company roles"
ON public.user_roles FOR DELETE
USING (
  has_role(auth.uid(), 'gerencia'::app_role)
  AND NOT is_protected_user(user_id)
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Coordinador can manage analista roles only
CREATE POLICY "Coordinador can insert analista roles"
ON public.user_roles FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'coordinador_mercadeo'::app_role)
  AND role = 'analista'::app_role
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Coordinador can update analista roles"
ON public.user_roles FOR UPDATE
USING (
  has_role(auth.uid(), 'coordinador_mercadeo'::app_role)
  AND role = 'analista'::app_role
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Coordinador can delete analista roles"
ON public.user_roles FOR DELETE
USING (
  has_role(auth.uid(), 'coordinador_mercadeo'::app_role)
  AND role = 'analista'::app_role
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Coordinador can view analista roles in their company
CREATE POLICY "Coordinador can view analista roles"
ON public.user_roles FOR SELECT
USING (
  has_role(auth.uid(), 'coordinador_mercadeo'::app_role)
  AND role = 'analista'::app_role
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Add default module_permissions for analista
INSERT INTO public.module_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  ('analista', 'acuerdos', true, false, false, false),
  ('analista', 'pagos', true, false, false, false),
  ('analista', 'entregables', true, false, false, false),
  ('analista', 'kpis', true, true, true, false);
