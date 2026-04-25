ALTER TABLE public.entregables
  ADD COLUMN meta_alcance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN meta_impresiones INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN meta_interacciones INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN meta_clicks INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.kpis
  ADD COLUMN meta_alcance_snapshot INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN meta_impresiones_snapshot INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN meta_interacciones_snapshot INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN meta_clicks_snapshot INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN cumplimiento_alcance NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN cumplimiento_impresiones NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN cumplimiento_interacciones NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN cumplimiento_clicks NUMERIC(6,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.entregables.meta_alcance IS 'Meta de alcance esperado para este entregable';
COMMENT ON COLUMN public.entregables.meta_impresiones IS 'Meta de impresiones esperadas para este entregable';
COMMENT ON COLUMN public.entregables.meta_interacciones IS 'Meta de interacciones esperadas para este entregable';
COMMENT ON COLUMN public.entregables.meta_clicks IS 'Meta de clicks esperados para este entregable';

COMMENT ON COLUMN public.kpis.meta_alcance_snapshot IS 'Meta de alcance en el momento del registro (snapshot histórico)';
COMMENT ON COLUMN public.kpis.meta_impresiones_snapshot IS 'Meta de impresiones en el momento del registro (snapshot histórico)';
COMMENT ON COLUMN public.kpis.meta_interacciones_snapshot IS 'Meta de interacciones en el momento del registro (snapshot histórico)';
COMMENT ON COLUMN public.kpis.meta_clicks_snapshot IS 'Meta de clicks en el momento del registro (snapshot histórico)';
COMMENT ON COLUMN public.kpis.cumplimiento_alcance IS '% cumplimiento alcance: real/meta*100. 0 si meta=0.';
COMMENT ON COLUMN public.kpis.cumplimiento_impresiones IS '% cumplimiento impresiones: real/meta*100. 0 si meta=0.';
COMMENT ON COLUMN public.kpis.cumplimiento_interacciones IS '% cumplimiento interacciones: real/meta*100. 0 si meta=0.';
COMMENT ON COLUMN public.kpis.cumplimiento_clicks IS '% cumplimiento clicks: real/meta*100. 0 si meta=0.';