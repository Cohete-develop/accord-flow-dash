REVOKE EXECUTE ON FUNCTION public.create_vault_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_vault_secret(text, text) TO service_role;