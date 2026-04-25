CREATE OR REPLACE FUNCTION public.get_companies_with_user_count()
RETURNS TABLE (
  id UUID,
  name TEXT,
  domain TEXT,
  logo_url TEXT,
  slug TEXT,
  plan TEXT,
  is_active BOOLEAN,
  user_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.name, c.domain, c.logo_url, c.slug, c.plan, c.is_active,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.company_id = c.id) AS user_count
  FROM public.companies c
  WHERE public.is_super_admin_no_impersonation(auth.uid())
  ORDER BY c.name;
$$;