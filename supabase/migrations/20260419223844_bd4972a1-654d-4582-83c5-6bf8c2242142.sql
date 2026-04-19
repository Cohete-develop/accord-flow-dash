-- Agregar columnas para nombre del invitado y revocación
ALTER TABLE public.invitations 
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Índice único para el token (rápido lookup)
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);

-- Índice para búsqueda por empresa
CREATE INDEX IF NOT EXISTS invitations_company_idx ON public.invitations(company_id);

-- Política para que gerencia pueda actualizar (revocar) invitaciones de su empresa
CREATE POLICY "Gerencia update invitations of company"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gerencia'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);