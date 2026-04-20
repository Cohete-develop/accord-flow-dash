
-- =========================================================
-- CAMPAIGN MONITOR (premium module) — schema
-- =========================================================

-- 0. Helper: ¿la empresa tiene plan premium?
CREATE OR REPLACE FUNCTION public.has_premium_plan(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id
      AND plan IN ('pro', 'enterprise')
      AND is_active = true
  )
$$;

-- 1. ad_platform_connections
CREATE TABLE public.ad_platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('google_ads','meta_ads','tiktok_ads','linkedin_ads','webhook')),
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL DEFAULT '',
  -- Vault secret UUID (gen_random_uuid → vault.create_secret). NUNCA texto plano.
  credentials_vault_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','error')),
  last_sync_at TIMESTAMPTZ,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
  connected_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, platform, account_id)
);
CREATE INDEX idx_ad_platform_connections_company_id ON public.ad_platform_connections(company_id);

-- 2. campaigns_sync
CREATE TABLE public.campaigns_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.ad_platform_connections(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended','draft')),
  daily_budget NUMERIC NOT NULL DEFAULT 0,
  total_budget NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_campaign_id)
);
CREATE INDEX idx_campaigns_sync_company_id ON public.campaigns_sync(company_id);
CREATE INDEX idx_campaigns_sync_connection ON public.campaigns_sync(connection_id);

-- 3. campaign_metrics
CREATE TABLE public.campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_sync_id UUID NOT NULL REFERENCES public.campaigns_sync(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour INTEGER CHECK (hour BETWEEN 0 AND 23),
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  conversion_value NUMERIC NOT NULL DEFAULT 0,
  cpc NUMERIC NOT NULL DEFAULT 0,
  cpa NUMERIC NOT NULL DEFAULT 0,
  roas NUMERIC NOT NULL DEFAULT 0,
  platform_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_sync_id, date, hour)
);
CREATE INDEX idx_campaign_metrics_company_id ON public.campaign_metrics(company_id);
CREATE INDEX idx_campaign_metrics_campaign_date ON public.campaign_metrics(campaign_sync_id, date);

-- 4. campaign_keywords
CREATE TABLE public.campaign_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_sync_id UUID NOT NULL REFERENCES public.campaigns_sync(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'broad' CHECK (match_type IN ('exact','phrase','broad')),
  quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'active',
  date DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  cpc NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_keywords_company_id ON public.campaign_keywords(company_id);
CREATE INDEX idx_campaign_keywords_campaign_date ON public.campaign_keywords(campaign_sync_id, date);

-- 5. campaign_alerts
CREATE TABLE public.campaign_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_sync_id UUID REFERENCES public.campaigns_sync(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('ctr','cpc','cpa','roas','cost','conversions','quality_score')),
  condition TEXT NOT NULL CHECK (condition IN ('drops_below','exceeds','changes_by_percent')),
  threshold NUMERIC NOT NULL,
  window_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_channels JSONB NOT NULL DEFAULT '["in_app"]'::jsonb,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_alerts_company_id ON public.campaign_alerts(company_id);

-- 6. alert_history
CREATE TABLE public.alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES public.campaign_alerts(id) ON DELETE CASCADE,
  campaign_sync_id UUID REFERENCES public.campaigns_sync(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metric_value NUMERIC NOT NULL,
  threshold_value NUMERIC NOT NULL,
  message TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID
);
CREATE INDEX idx_alert_history_company_id ON public.alert_history(company_id);
CREATE INDEX idx_alert_history_triggered ON public.alert_history(triggered_at DESC);

-- =========================================================
-- updated_at triggers
-- =========================================================
CREATE TRIGGER trg_ad_connections_updated BEFORE UPDATE ON public.ad_platform_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_campaigns_sync_updated BEFORE UPDATE ON public.campaigns_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Vista SAFE para el frontend (sin credentials_vault_id)
-- =========================================================
CREATE VIEW public.ad_connections_safe
WITH (security_invoker = true) AS
SELECT id, company_id, platform, account_id, account_name, status,
       last_sync_at, sync_interval_minutes, connected_by, created_at, updated_at
FROM public.ad_platform_connections;

-- =========================================================
-- RLS para todas las tablas (patrón estándar del tenant)
-- =========================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ad_platform_connections','campaigns_sync','campaign_metrics',
    'campaign_keywords','campaign_alerts','alert_history'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format($f$CREATE POLICY "Users view %1$s by company" ON public.%1$I
      FOR SELECT TO authenticated
      USING (company_id = public.get_user_company_id(auth.uid()));$f$, t);

    EXECUTE format($f$CREATE POLICY "Users insert %1$s with company" ON public.%1$I
      FOR INSERT TO authenticated
      WITH CHECK (company_id = public.get_user_company_id(auth.uid()));$f$, t);

    EXECUTE format($f$CREATE POLICY "Users update %1$s by company" ON public.%1$I
      FOR UPDATE TO authenticated
      USING (company_id = public.get_user_company_id(auth.uid()));$f$, t);

    EXECUTE format($f$CREATE POLICY "Users delete %1$s by company" ON public.%1$I
      FOR DELETE TO authenticated
      USING (company_id = public.get_user_company_id(auth.uid()));$f$, t);

    EXECUTE format($f$CREATE POLICY "Super admin full access %1$s" ON public.%1$I
      FOR ALL
      USING (public.has_role(auth.uid(), 'super_admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));$f$, t);
  END LOOP;
END $$;

-- =========================================================
-- Permisos por rol del módulo campaign_monitor
-- =========================================================
INSERT INTO public.module_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  ('gerencia',             'campaign_monitor', true, true,  true,  true),
  ('coordinador_mercadeo', 'campaign_monitor', true, true,  true,  false),
  ('admin_contabilidad',   'campaign_monitor', true, false, false, false),
  ('analista',             'campaign_monitor', true, false, false, false)
ON CONFLICT DO NOTHING;
