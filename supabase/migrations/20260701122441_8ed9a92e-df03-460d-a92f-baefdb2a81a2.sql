
CREATE OR REPLACE FUNCTION public.import_campaign_metrics(
  _platform text,
  _period_start date,
  _period_end date,
  _rows jsonb,
  _dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id      uuid;
  v_user_id         uuid := auth.uid();
  v_connection_id   uuid;
  v_campaign_id     uuid;
  v_row             jsonb;
  v_name            text;
  v_name_norm       text;
  v_date            date;
  v_currency        text;
  v_impr            integer;
  v_clicks          integer;
  v_cost            numeric;
  v_conv            integer;
  v_conv_value      numeric;
  v_rows_received   int := 0;
  v_rows_skipped    int := 0;
  v_rows_valid      int := 0;
  v_inserted        int := 0;
  v_updated         int := 0;
  v_campaigns       uuid[] := ARRAY[]::uuid[];
  v_agg             record;
  v_ctr             numeric;
  v_cpc             numeric;
  v_cpa             numeric;
  v_roas            numeric;
  v_external_id     text;
  v_was_insert      boolean;
  v_totals_by_curr  jsonb;
  v_by_campaign     jsonb;
  v_campaigns_count int := 0;
BEGIN
  -- Tenant resolution (respects impersonation)
  v_company_id := public.get_user_company_id(v_user_id);
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver la empresa del usuario (super_admin sin impersonar no puede importar)';
  END IF;

  -- Plan gate
  PERFORM 1
  FROM public.get_company_plan_limits(v_company_id) AS limits
  WHERE 'campaign_monitor' = ANY(limits.modules_included);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_ALLOWED: Campaign Monitor no está incluido en el plan actual';
  END IF;

  -- Platform validation
  IF _platform NOT IN ('google_ads','meta_ads','tiktok_ads','linkedin_ads') THEN
    RAISE EXCEPTION 'Plataforma inválida: %', _platform;
  END IF;

  IF _period_start IS NULL OR _period_end IS NULL OR _period_start > _period_end THEN
    RAISE EXCEPTION 'Período inválido: % .. %', _period_start, _period_end;
  END IF;

  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'Payload _rows vacío o no es array';
  END IF;

  -- === STAGING TEMP TABLE ===
  CREATE TEMP TABLE _staging_rows (
    campaign_name    text,
    campaign_name_n  text,
    date             date,
    currency         text,
    impressions      integer,
    clicks           integer,
    cost             numeric,
    conversions      integer,
    conversion_value numeric
  ) ON COMMIT DROP;

  FOR v_row IN SELECT * FROM jsonb_array_elements(_rows)
  LOOP
    v_rows_received := v_rows_received + 1;

    v_name := NULLIF(trim(COALESCE(v_row->>'campaign_name','')), '');
    v_name_norm := lower(COALESCE(v_name, ''));

    -- Skip empty names or "total:" rows (refined: 'total:' with colon, not 'total%')
    IF v_name IS NULL OR v_name_norm LIKE 'total:%' THEN
      v_rows_skipped := v_rows_skipped + 1;
      CONTINUE;
    END IF;

    BEGIN
      v_date := (v_row->>'date')::date;
    EXCEPTION WHEN OTHERS THEN
      v_rows_skipped := v_rows_skipped + 1;
      CONTINUE;
    END;
    IF v_date IS NULL THEN
      v_rows_skipped := v_rows_skipped + 1;
      CONTINUE;
    END IF;

    BEGIN
      v_impr   := (v_row->>'impressions')::integer;
      v_clicks := (v_row->>'clicks')::integer;
      v_cost   := (v_row->>'cost')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_rows_skipped := v_rows_skipped + 1;
      CONTINUE;
    END;

    IF v_impr IS NULL OR v_clicks IS NULL OR v_cost IS NULL
       OR v_impr < 0 OR v_clicks < 0 OR v_cost < 0 THEN
      v_rows_skipped := v_rows_skipped + 1;
      CONTINUE;
    END IF;

    v_currency := NULLIF(trim(COALESCE(v_row->>'currency','')), '');
    IF v_currency IS NULL THEN
      v_rows_skipped := v_rows_skipped + 1;
      CONTINUE;
    END IF;

    v_conv := COALESCE(NULLIF(v_row->>'conversions','')::integer, 0);
    v_conv_value := COALESCE(NULLIF(v_row->>'conversion_value','')::numeric, 0);
    IF v_conv < 0 THEN v_conv := 0; END IF;
    IF v_conv_value < 0 THEN v_conv_value := 0; END IF;

    INSERT INTO _staging_rows(campaign_name, campaign_name_n, date, currency,
      impressions, clicks, cost, conversions, conversion_value)
    VALUES (v_name, lower(trim(v_name)), v_date, v_currency,
      v_impr, v_clicks, v_cost, v_conv, v_conv_value);

    v_rows_valid := v_rows_valid + 1;
  END LOOP;

  -- === DRY RUN: return aggregates without writing ===
  IF _dry_run THEN
    SELECT COUNT(DISTINCT campaign_name_n) INTO v_campaigns_count FROM _staging_rows;

    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_totals_by_curr
    FROM (
      SELECT currency,
             SUM(cost)::numeric             AS cost,
             SUM(impressions)::bigint       AS impressions,
             SUM(clicks)::bigint            AS clicks,
             SUM(conversions)::numeric      AS conversions,
             SUM(conversion_value)::numeric AS conversion_value
      FROM _staging_rows
      GROUP BY currency
      ORDER BY currency
    ) t;

    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_by_campaign
    FROM (
      SELECT MIN(campaign_name)             AS campaign_name,
             MIN(currency)                  AS currency,
             SUM(impressions)::bigint       AS impressions,
             SUM(clicks)::bigint            AS clicks,
             SUM(cost)::numeric             AS cost,
             SUM(conversions)::numeric      AS conversions,
             SUM(conversion_value)::numeric AS conversion_value
      FROM _staging_rows
      GROUP BY campaign_name_n
      ORDER BY MIN(campaign_name)
    ) t;

    RETURN jsonb_build_object(
      'dry_run', true,
      'rows_received', v_rows_received,
      'rows_valid', v_rows_valid,
      'rows_skipped', v_rows_skipped,
      'campaigns_count', v_campaigns_count,
      'totals_by_currency', v_totals_by_curr,
      'by_campaign', v_by_campaign
    );
  END IF;

  -- === NORMAL MODE: upsert connection + aggregated rows ===
  INSERT INTO public.ad_platform_connections (
    company_id, platform, account_id, account_name, status,
    credentials_vault_id, connected_by
  ) VALUES (
    v_company_id, _platform, 'manual_import', 'Importación manual', 'active',
    NULL, v_user_id
  )
  ON CONFLICT (company_id, platform, account_id) DO UPDATE
    SET updated_at = now()
  RETURNING id INTO v_connection_id;

  -- Aggregate by (campaign_name_n, date) and upsert
  FOR v_agg IN
    SELECT
      MIN(campaign_name)             AS campaign_name,
      campaign_name_n,
      date                           AS d,
      MIN(currency)                  AS currency,
      SUM(impressions)::integer      AS impressions,
      SUM(clicks)::integer           AS clicks,
      SUM(cost)::numeric             AS cost,
      SUM(conversions)::integer      AS conversions,
      SUM(conversion_value)::numeric AS conversion_value
    FROM _staging_rows
    GROUP BY campaign_name_n, date
  LOOP
    v_ctr  := CASE WHEN v_agg.impressions > 0 THEN v_agg.clicks::numeric / v_agg.impressions::numeric ELSE NULL END;
    v_cpc  := CASE WHEN v_agg.clicks      > 0 THEN v_agg.cost / v_agg.clicks::numeric ELSE NULL END;
    v_cpa  := CASE WHEN v_agg.conversions > 0 THEN v_agg.cost / v_agg.conversions::numeric ELSE NULL END;
    v_roas := CASE WHEN v_agg.cost        > 0 THEN v_agg.conversion_value / v_agg.cost ELSE NULL END;

    v_external_id := 'manual_' || _platform || '_' || v_agg.campaign_name_n;

    INSERT INTO public.campaigns_sync (
      company_id, connection_id, platform, external_campaign_id, campaign_name,
      status, currency, start_date, end_date, data_source
    ) VALUES (
      v_company_id, v_connection_id, _platform, v_external_id, v_agg.campaign_name,
      'active', v_agg.currency, _period_start, _period_end, 'manual_import'
    )
    ON CONFLICT (connection_id, external_campaign_id) DO UPDATE
      SET campaign_name = EXCLUDED.campaign_name,
          currency      = EXCLUDED.currency,
          start_date    = EXCLUDED.start_date,
          end_date      = EXCLUDED.end_date,
          updated_at    = now()
    RETURNING id INTO v_campaign_id;

    IF NOT (v_campaign_id = ANY(v_campaigns)) THEN
      v_campaigns := array_append(v_campaigns, v_campaign_id);
    END IF;

    INSERT INTO public.campaign_metrics AS m (
      company_id, campaign_sync_id, date, hour, data_source,
      impressions, clicks, cost, conversions, conversion_value,
      ctr, cpc, cpa, roas
    ) VALUES (
      v_company_id, v_campaign_id, v_agg.d, NULL, 'manual_import',
      v_agg.impressions, v_agg.clicks, v_agg.cost, v_agg.conversions, v_agg.conversion_value,
      v_ctr, v_cpc, v_cpa, v_roas
    )
    ON CONFLICT (campaign_sync_id, date) WHERE data_source = 'manual_import'
    DO UPDATE SET
      impressions      = EXCLUDED.impressions,
      clicks           = EXCLUDED.clicks,
      cost             = EXCLUDED.cost,
      conversions      = EXCLUDED.conversions,
      conversion_value = EXCLUDED.conversion_value,
      ctr              = EXCLUDED.ctr,
      cpc              = EXCLUDED.cpc,
      cpa              = EXCLUDED.cpa,
      roas             = EXCLUDED.roas,
      hour             = NULL
    RETURNING (xmax = 0) INTO v_was_insert;

    IF v_was_insert THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted',          v_inserted,
    'updated',           v_updated,
    'skipped',           v_rows_skipped,
    'rows_received',     v_rows_received,
    'campaigns_touched', COALESCE(array_length(v_campaigns, 1), 0)
  );
END;
$function$;
