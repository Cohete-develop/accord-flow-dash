ALTER TABLE public.acuerdos DROP COLUMN familia_producto;
ALTER TABLE public.acuerdos ADD COLUMN familia_producto text[] NOT NULL DEFAULT '{}'::text[];