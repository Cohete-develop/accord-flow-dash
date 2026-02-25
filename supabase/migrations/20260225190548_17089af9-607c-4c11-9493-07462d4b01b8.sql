
-- Create a security definer function to check if a user has a protected role (super_admin)
CREATE OR REPLACE FUNCTION public.is_protected_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Drop the overly permissive gerencia policy on profiles
DROP POLICY IF EXISTS "Gerencia can manage all profiles" ON public.profiles;

-- Gerencia can view all profiles in their company (already exists, keep it)

-- Gerencia can update profiles in their company, but NOT super_admin users
CREATE POLICY "Gerencia can update company profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gerencia') 
  AND company_id = get_user_company_id(auth.uid())
  AND NOT is_protected_user(user_id)
);

-- Gerencia can insert profiles (for new users in their company)
CREATE POLICY "Gerencia can insert company profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gerencia')
  AND company_id = get_user_company_id(auth.uid())
);

-- Gerencia can delete profiles in their company, but NOT super_admin users
CREATE POLICY "Gerencia can delete company profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'gerencia')
  AND company_id = get_user_company_id(auth.uid())
  AND NOT is_protected_user(user_id)
);

-- Also protect user_roles: gerencia should not be able to modify super_admin roles
DROP POLICY IF EXISTS "Gerencia can manage all roles" ON public.user_roles;

-- Gerencia can view roles in their company
CREATE POLICY "Gerencia can view company roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'gerencia')
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = user_roles.user_id 
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Gerencia can insert non-protected roles for users in their company
CREATE POLICY "Gerencia can insert company roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gerencia')
  AND role NOT IN ('super_admin', 'gerencia')
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = user_roles.user_id 
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Gerencia can update roles for non-protected users in their company
CREATE POLICY "Gerencia can update company roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gerencia')
  AND NOT is_protected_user(user_roles.user_id)
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = user_roles.user_id 
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- Gerencia can delete roles for non-protected users in their company
CREATE POLICY "Gerencia can delete company roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'gerencia')
  AND NOT is_protected_user(user_roles.user_id)
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = user_roles.user_id 
    AND p.company_id = get_user_company_id(auth.uid())
  )
);
