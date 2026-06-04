CREATE OR REPLACE FUNCTION public.update_vault_secret(_secret_id uuid, _new_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  PERFORM vault.update_secret(_secret_id, _new_secret);
END;
$$;

REVOKE ALL ON FUNCTION public.update_vault_secret(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_vault_secret(uuid, text) TO service_role;

COMMENT ON FUNCTION public.update_vault_secret(uuid, text) IS 'Updates a Vault secret using vault.update_secret helper. Service role only.';