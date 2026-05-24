CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE OR REPLACE FUNCTION public.create_vault_secret(p_name text, p_secret text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT vault.create_secret(p_secret, p_name, p_name);
$$;