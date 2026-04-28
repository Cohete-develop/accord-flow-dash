-- =========================================================
-- Fase 2 — Vista de monitoreo de uso del asistente IA
-- =========================================================
-- security_invoker = true → la vista respeta las RLS de audit_log
-- (gerencia ve su empresa, super_admin ve todo).
CREATE OR REPLACE VIEW public.audit_log_ai_usage_hourly
WITH (security_invoker = true) AS
SELECT
  user_id,
  user_name,
  company_id,
  date_trunc('hour', created_at) AS hour,
  COUNT(*) AS invocations
FROM public.audit_log
WHERE module = 'ai_assistant'
  AND created_at > now() - interval '24 hours'
GROUP BY user_id, user_name, company_id, date_trunc('hour', created_at);

COMMENT ON VIEW public.audit_log_ai_usage_hourly IS
  'Agregación horaria de invocaciones al asistente IA en las últimas 24h. Usar para detectar abuso: SELECT * FROM audit_log_ai_usage_hourly WHERE invocations > 50;';

-- =========================================================
-- Fase 2 — Ranking ROAS top/bottom por plataforma en una query
-- =========================================================
-- Devuelve top 3 + bottom 3 campañas por ROAS dentro de cada plataforma
-- para una empresa y rango de fechas. Excluye campañas con cost < _min_cost
-- en el período para evitar distorsión por campañas con muy poco gasto.
CREATE OR REPLACE FUNCTION public.get_campaign_roas_ranking(
  _company_id uuid,
  _start_date date,
  _end_date date,
  _min_cost numeric DEFAULT 10,
  _top_n integer DEFAULT 3
)
RETURNS TABLE (
  platform text,
  campaign_sync_id uuid,
  campaign_name text,
  status text,
  cost numeric,
  conversions bigint,
  conversion_value numeric,
  roas numeric,
  rank_type text,
  rank_position bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      cs.platform,
      cs.id AS campaign_sync_id,
      cs.campaign_name,
      cs.status,
      COALESCE(SUM(cm.cost), 0) AS cost,
      COALESCE(SUM(cm.conversions), 0) AS conversions,
      COALESCE(SUM(cm.conversion_value), 0) AS conversion_value,
      CASE
        WHEN COALESCE(SUM(cm.cost), 0) > 0
        THEN COALESCE(SUM(cm.conversion_value), 0) / SUM(cm.cost)
        ELSE 0
      END AS roas
    FROM public.campaigns_sync cs
    LEFT JOIN public.campaign_metrics cm
      ON cm.campaign_sync_id = cs.id
     AND cm.company_id = cs.company_id
     AND cm.date BETWEEN _start_date AND _end_date
    WHERE cs.company_id = _company_id
    GROUP BY cs.platform, cs.id, cs.campaign_name, cs.status
    HAVING COALESCE(SUM(cm.cost), 0) >= _min_cost
  ),
  ranked AS (
    SELECT
      a.*,
      ROW_NUMBER() OVER (PARTITION BY a.platform ORDER BY a.roas DESC) AS rn_top,
      ROW_NUMBER() OVER (PARTITION BY a.platform ORDER BY a.roas ASC)  AS rn_bottom
    FROM agg a
  )
  SELECT
    platform, campaign_sync_id, campaign_name, status,
    cost, conversions, conversion_value, roas,
    'top'::text AS rank_type, rn_top AS rank_position
  FROM ranked WHERE rn_top <= _top_n
  UNION ALL
  SELECT
    platform, campaign_sync_id, campaign_name, status,
    cost, conversions, conversion_value, roas,
    'bottom'::text AS rank_type, rn_bottom AS rank_position
  FROM ranked WHERE rn_bottom <= _top_n
  ORDER BY platform, rank_type, rank_position;
$$;

COMMENT ON FUNCTION public.get_campaign_roas_ranking IS
  'Devuelve top N + bottom N campañas por ROAS por plataforma, excluyendo campañas con cost < _min_cost en el período. Usado por EngineXpert (Fase 2).';