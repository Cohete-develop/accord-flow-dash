CREATE OR REPLACE FUNCTION public.get_vault_secret(_secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = _secret_id;
  RETURN secret_value;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vault_secret(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(uuid) TO service_role;
COMMENT ON FUNCTION public.get_vault_secret(uuid) IS
'Reads decrypted secret from vault. Service role only. Used by Edge Functions to retrieve OAuth tokens for Campaign Monitor.';

CREATE OR REPLACE FUNCTION public.update_vault_secret(_secret_id uuid, _new_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  UPDATE vault.secrets SET secret = _new_secret WHERE id = _secret_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_vault_secret(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_vault_secret(uuid, text) TO service_role;
COMMENT ON FUNCTION public.update_vault_secret(uuid, text) IS
'Updates decrypted secret in vault in-place. Service role only. Used by Edge Functions to refresh OAuth tokens.';