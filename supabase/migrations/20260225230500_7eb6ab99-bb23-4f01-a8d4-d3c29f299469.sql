
-- Add valor_mensual_snapshot column to kpis table
ALTER TABLE public.kpis ADD COLUMN IF NOT EXISTS valor_mensual_snapshot numeric NOT NULL DEFAULT 0;
