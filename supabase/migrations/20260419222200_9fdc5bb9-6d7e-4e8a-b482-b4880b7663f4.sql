-- ============================================================
-- 1. Crear el trigger faltante on_auth_user_created
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Backfill: crear profiles para usuarios existentes que no los tienen
--    y asociarlos a su company por dominio del email (excepto super_admin que queda sin company).
-- ============================================================
INSERT INTO public.profiles (user_id, email, first_name, last_name, full_name, company_id)
SELECT 
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'first_name', ''),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    trim(COALESCE(u.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(u.raw_user_meta_data->>'last_name', ''))
  ),
  CASE 
    WHEN public.is_platform_domain(lower(split_part(u.email, '@', 2))) THEN NULL
    ELSE (SELECT id FROM public.companies WHERE lower(domain) = lower(split_part(u.email, '@', 2)) LIMIT 1)
  END
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;