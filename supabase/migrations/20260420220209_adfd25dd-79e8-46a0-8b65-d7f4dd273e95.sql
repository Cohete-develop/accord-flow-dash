CREATE TABLE public.plan_definitions (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  max_seats INTEGER NOT NULL DEFAULT 5,
  monthly_price_usd NUMERIC DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]',
  modules_included TEXT[] NOT NULL DEFAULT '{"dashboard","acuerdos","pagos","entregables","kpis"}',
  max_ad_connections INTEGER DEFAULT 0,
  max_campaigns_sync INTEGER DEFAULT 0,
  sync_interval_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.plan_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view plans" ON public.plan_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin manages plans" ON public.plan_definitions
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.plan_definitions (id, display_name, max_seats, monthly_price_usd, modules_included, max_ad_connections, max_campaigns_sync, sync_interval_minutes, sort_order, features) VALUES
  ('trial', 'Trial', 3, 0,
   '{"dashboard","acuerdos","pagos","entregables","kpis"}',
   0, 0, 0, 1,
   '["Dashboard básico", "Hasta 3 usuarios", "Acuerdos, Pagos, Entregables, KPIs", "Soporte por email"]'),
  ('starter', 'Starter', 10, 49,
   '{"dashboard","acuerdos","pagos","entregables","kpis"}',
   0, 0, 0, 2,
   '["Todo lo de Trial", "Hasta 10 usuarios", "Exportación de datos", "Soporte prioritario"]'),
  ('pro', 'Pro', 25, 149,
   '{"dashboard","acuerdos","pagos","entregables","kpis","campaign_monitor"}',
   3, 20, 30, 3,
   '["Todo lo de Starter", "Hasta 25 usuarios", "Campaign Monitor", "Hasta 3 plataformas conectadas", "Hasta 20 campañas sincronizadas", "Sincronización cada 30 min", "Alertas ilimitadas"]'),
  ('enterprise', 'Enterprise', 100, 399,
   '{"dashboard","acuerdos","pagos","entregables","kpis","campaign_monitor"}',
   10, 100, 15, 4,
   '["Todo lo de Pro", "Hasta 100 usuarios", "Hasta 10 plataformas", "Hasta 100 campañas", "Sincronización cada 15 min", "Soporte dedicado", "Onboarding personalizado"]');

-- Asegurar que cualquier company existente con plan no listado quede como 'trial' antes del FK
UPDATE public.companies
   SET plan = 'trial'
 WHERE plan NOT IN (SELECT id FROM public.plan_definitions);

ALTER TABLE public.companies
  ADD CONSTRAINT companies_plan_fkey
  FOREIGN KEY (plan) REFERENCES public.plan_definitions(id);

CREATE OR REPLACE FUNCTION public.has_premium_plan(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.plan_definitions pd ON pd.id = c.plan
    WHERE c.id = _company_id
      AND c.is_active = true
      AND 'campaign_monitor' = ANY(pd.modules_included)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_company_plan_limits(_company_id UUID)
RETURNS TABLE(
  plan_id TEXT, max_seats INTEGER, modules_included TEXT[],
  max_ad_connections INTEGER, max_campaigns_sync INTEGER,
  sync_interval_minutes INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pd.id, pd.max_seats, pd.modules_included,
         pd.max_ad_connections, pd.max_campaigns_sync,
         pd.sync_interval_minutes
  FROM public.companies c
  JOIN public.plan_definitions pd ON pd.id = c.plan
  WHERE c.id = _company_id
$$;