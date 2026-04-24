-- CRM principal
ALTER TABLE public.acuerdos ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.pagos ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.entregables ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.kpis ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;

-- Campaign Monitor
ALTER TABLE public.ad_platform_connections ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.campaigns_sync ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.campaign_metrics ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.campaign_keywords ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.campaign_alerts ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.alert_history ADD COLUMN is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;

-- Índices parciales para limpieza rápida
CREATE INDEX idx_acuerdos_demo ON public.acuerdos(company_id) WHERE is_demo_data = TRUE;
CREATE INDEX idx_pagos_demo ON public.pagos(company_id) WHERE is_demo_data = TRUE;
CREATE INDEX idx_entregables_demo ON public.entregables(company_id) WHERE is_demo_data = TRUE;
CREATE INDEX idx_kpis_demo ON public.kpis(company_id) WHERE is_demo_data = TRUE;
CREATE INDEX idx_campaigns_sync_demo ON public.campaigns_sync(company_id) WHERE is_demo_data = TRUE;
CREATE INDEX idx_campaign_metrics_demo ON public.campaign_metrics(company_id) WHERE is_demo_data = TRUE;