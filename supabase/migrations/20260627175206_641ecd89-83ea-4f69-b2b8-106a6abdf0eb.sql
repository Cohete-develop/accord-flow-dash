
-- 1) data_source column on both tables
ALTER TABLE public.campaigns_sync
  ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'oauth'
    CHECK (data_source IN ('oauth','manual_import'));

ALTER TABLE public.campaign_metrics
  ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'oauth'
    CHECK (data_source IN ('oauth','manual_import'));

-- 2) Partial unique index for manual import idempotency
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_metrics_manual_day
  ON public.campaign_metrics (campaign_sync_id, date)
  WHERE data_source = 'manual_import';

-- 3) RPC: import_campaign_metrics
CREATE OR REPLACE FUNCTION public.import_campaign_metrics(
  _platform     text,
  _period_start date,
  _period_end   date,
  _rows         jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  v_ctr             numeric;
  v_cpc             numeric;
  v_cpa             numeric;
  v_roas            numeric;
  v_external_id     text;
  v_was_insert      boolean;
  v_inserted        int := 0;
  v_updated         int := 0;
  v_skipped         int := 0;
  v_campaigns       uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Tenant resolution (respects impersonation)
  v_company_id := public.get_user_company_id(v_user_id);
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver la empresa del usuario (super_admin sin impersonar no puede importar)';
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

  -- Upsert synthetic connection (one per company+platform, distinguished by account_id)
  -- Isolation is enforced by v_company_id, never by payload.
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

  -- Iterate rows
  FOR v_row IN SELECT * FROM jsonb_array_elements(_rows)
  LOOP
    v_name := NULLIF(trim(COALESCE(v_row->>'campaign_name','')), '');
    v_name_norm := lower(COALESCE(v_name, ''));

    IF v_name IS NULL OR v_name_norm LIKE 'total%' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Date
    BEGIN
      v_date := (v_row->>'date')::date;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END;
    IF v_date IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Required numerics
    BEGIN
      v_impr   := (v_row->>'impressions')::integer;
      v_clicks := (v_row->>'clicks')::integer;
      v_cost   := (v_row->>'cost')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END;

    IF v_impr IS NULL OR v_clicks IS NULL OR v_cost IS NULL
       OR v_impr < 0 OR v_clicks < 0 OR v_cost < 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_currency := NULLIF(trim(COALESCE(v_row->>'currency','')), '');
    IF v_currency IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Optional numerics
    v_conv := COALESCE(NULLIF(v_row->>'conversions','')::integer, 0);
    v_conv_value := COALESCE(NULLIF(v_row->>'conversion_value','')::numeric, 0);
    IF v_conv < 0 THEN v_conv := 0; END IF;
    IF v_conv_value < 0 THEN v_conv_value := 0; END IF;

    -- Derived metrics (server-side)
    v_ctr  := CASE WHEN v_impr   > 0 THEN v_clicks::numeric / v_impr::numeric ELSE NULL END;
    v_cpc  := CASE WHEN v_clicks > 0 THEN v_cost   / v_clicks::numeric ELSE NULL END;
    v_cpa  := CASE WHEN v_conv   > 0 THEN v_cost   / v_conv::numeric   ELSE NULL END;
    v_roas := CASE WHEN v_cost   > 0 THEN v_conv_value / v_cost        ELSE NULL END;

    v_external_id := 'manual_' || _platform || '_' || lower(v_name);

    -- Upsert campaign
    INSERT INTO public.campaigns_sync (
      company_id, connection_id, platform, external_campaign_id, campaign_name,
      status, currency, start_date, end_date, data_source
    ) VALUES (
      v_company_id, v_connection_id, _platform, v_external_id, v_name,
      'active', v_currency, _period_start, _period_end, 'manual_import'
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

    -- Upsert metric (uses partial unique index uq_campaign_metrics_manual_day)
    INSERT INTO public.campaign_metrics AS m (
      company_id, campaign_sync_id, date, hour, data_source,
      impressions, clicks, cost, conversions, conversion_value,
      ctr, cpc, cpa, roas
    ) VALUES (
      v_company_id, v_campaign_id, v_date, NULL, 'manual_import',
      v_impr, v_clicks, v_cost, v_conv, v_conv_value,
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
    'skipped',           v_skipped,
    'campaigns_touched', COALESCE(array_length(v_campaigns, 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_campaign_metrics(text, date, date, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.import_campaign_metrics(text, date, date, jsonb) TO authenticated;

COMMENT ON FUNCTION public.import_campaign_metrics(text, date, date, jsonb) IS
'Importa métricas de campañas manualmente. El aislamiento por tenant lo garantiza get_user_company_id(auth.uid()), nunca el payload del cliente.';
