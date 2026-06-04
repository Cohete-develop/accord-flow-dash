import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const LOG_PREFIX = "[campaign-sync-data]";

interface VaultTokenBlob {
  access_token: string;
  refresh_token: string;
  expires_at?: string;
  scope?: string;
  token_type?: string;
  account_id?: string;
  all_accounts?: unknown;
}

function mapGoogleStatus(s: string | undefined): string {
  switch ((s || "").toUpperCase()) {
    case "ENABLED": return "active";
    case "PAUSED": return "paused";
    case "REMOVED": return "removed";
    default: return (s || "unknown").toLowerCase();
  }
}

/**
 * Campaign Monitor — Real sync against Google Ads API v24.
 * Reads OAuth tokens from Supabase Vault via public.get_vault_secret /
 * public.update_vault_secret RPCs. Refreshes tokens when near expiry.
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const err = (code: string, message: string, status = 400) =>
    json({ error: message, code }, status);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("NOT_AUTHENTICATED", "No authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
    const googleDevToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return err("NOT_AUTHENTICATED", "Not authenticated", 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin
      .from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle();
    if (!profile?.company_id) return err("NO_COMPANY", "Usuario sin empresa asociada", 403);

    // Plan + límites
    const { data: limits } = await admin.rpc("get_company_plan_limits", { _company_id: profile.company_id });
    if (!limits || limits.length === 0) return err("NO_PLAN", "Plan no configurado para esta empresa", 400);
    const planLimits = limits[0] as {
      plan_id: string;
      max_campaigns_sync: number;
      modules_included: string[];
    };
    if (!planLimits.modules_included?.includes("campaign_monitor")) {
      return err("PLAN_REQUIRED", "Campaign Monitor no está incluido en tu plan actual", 403);
    }

    const { count: syncedCampaigns } = await admin
      .from("campaigns_sync")
      .select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "active");

    if ((syncedCampaigns ?? 0) > (planLimits.max_campaigns_sync ?? 0)) {
      return err(
        "CAMPAIGN_LIMIT",
        `Tu plan ${planLimits.plan_id} permite máximo ${planLimits.max_campaigns_sync} campañas sincronizadas (actualmente ${syncedCampaigns}). Actualiza tu plan o pausa campañas.`,
        403,
      );
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* invocación sin body */ }
    const connectionId = body.connection_id as string | undefined;

    // Defensa en profundidad: SIEMPRE filtrar por company_id
    let connQuery = admin.from("ad_platform_connections")
      .select("id, platform, account_id, credentials_vault_id")
      .eq("company_id", profile.company_id)
      .eq("status", "active");
    if (connectionId) connQuery = connQuery.eq("id", connectionId);
    const { data: connections } = await connQuery;
    if (!connections || connections.length === 0) {
      return err("NO_CONNECTIONS", "No hay conexiones activas para sincronizar", 404);
    }

    let campaignsInserted = 0;
    let metricsInserted = 0;
    let connectionsProcessed = 0;

    for (const conn of connections) {
      if (conn.platform !== "google_ads") {
        console.log(`${LOG_PREFIX} skipping non-google_ads connection`, conn.id, conn.platform);
        continue;
      }
      if (!conn.credentials_vault_id) {
        console.warn(`${LOG_PREFIX} connection ${conn.id} sin credentials_vault_id; skip`);
        continue;
      }
      if (!googleClientId || !googleClientSecret || !googleDevToken) {
        return err("MISSING_GOOGLE_SECRETS", "Faltan secretos GOOGLE_ADS_* en la edge function", 500);
      }

      // (a) Leer token del Vault
      const { data: secretRaw, error: vaultErr } = await admin.rpc("get_vault_secret", {
        _secret_id: conn.credentials_vault_id,
      });
      if (vaultErr || !secretRaw) {
        console.error(`${LOG_PREFIX} get_vault_secret error`, vaultErr);
        return err("VAULT_READ_FAILED", "No se pudo leer el token del vault", 500);
      }
      let token: VaultTokenBlob;
      try { token = JSON.parse(secretRaw as string); }
      catch (e) {
        console.error(`${LOG_PREFIX} vault secret no es JSON válido`, e);
        return err("VAULT_INVALID_JSON", "Token en vault corrupto", 500);
      }

      // (b) Refresh si está por expirar (<5 min)
      if (token.expires_at && (Date.parse(token.expires_at) - Date.now()) < 5 * 60 * 1000) {
        console.log(`${LOG_PREFIX} refreshing token for connection ${conn.id}`);
        const form = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
          client_id: googleClientId,
          client_secret: googleClientSecret,
        });
        const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        });
        const refreshBody = await refreshResp.text();
        if (!refreshResp.ok) {
          console.error(`${LOG_PREFIX} refresh failed`, refreshResp.status, refreshBody);
          return err("TOKEN_REFRESH_FAILED", "No se pudo refrescar el token OAuth de Google", 401);
        }
        const refreshData = JSON.parse(refreshBody);
        token = {
          ...token,
          access_token: refreshData.access_token,
          expires_at: new Date(Date.now() + Number(refreshData.expires_in) * 1000).toISOString(),
          scope: refreshData.scope ?? token.scope,
          token_type: refreshData.token_type ?? token.token_type,
        };
        const { error: updErr } = await admin.rpc("update_vault_secret", {
          _secret_id: conn.credentials_vault_id,
          _new_secret: JSON.stringify(token),
        });
        if (updErr) {
          console.error(`${LOG_PREFIX} update_vault_secret error`, updErr);
          return err("VAULT_UPDATE_FAILED", "No se pudo persistir el token refrescado", 500);
        }
      }

      const accountId = token.account_id || conn.account_id;
      if (!accountId) {
        console.error(`${LOG_PREFIX} connection ${conn.id} sin account_id`);
        continue;
      }

      const gaUrl = `https://googleads.googleapis.com/v24/customers/${accountId}/googleAds:searchStream`;
      const gaHeaders = {
        "Authorization": `Bearer ${token.access_token}`,
        "developer-token": googleDevToken,
        "Content-Type": "application/json",
      };

      // Helper para llamadas a Google Ads con manejo unificado de errores
      const callGoogle = async (query: string) => {
        const resp = await fetch(gaUrl, {
          method: "POST",
          headers: gaHeaders,
          body: JSON.stringify({ query }),
        });
        const text = await resp.text();
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch { /* keep null */ }

        if (!resp.ok) {
          const errMsg = JSON.stringify(parsed ?? text);
          const isDevTokenPending =
            resp.status === 403 && (
              /DEVELOPER_TOKEN_NOT_APPROVED/i.test(errMsg) ||
              /developerTokenNotApproved/i.test(errMsg) ||
              (/PERMISSION_DENIED/i.test(errMsg) && /developer.?token/i.test(errMsg))
            );
          if (isDevTokenPending) {
            console.warn(`${LOG_PREFIX} developer token pending approval`, text);
            return { pendingApproval: true as const };
          }
          if (resp.status === 401) {
            console.error(`${LOG_PREFIX} Google Ads 401`, text);
            return { authError: true as const };
          }
          console.error(`${LOG_PREFIX} Google Ads error ${resp.status}`, text);
          return { apiError: parsed?.error?.message || text };
        }
        return { ok: true as const, data: parsed };
      };

      // (c) Listar campañas
      const campRes = await callGoogle(
        "SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign WHERE campaign.status != 'REMOVED'",
      );
      if ("pendingApproval" in campRes) {
        return json({
          success: false,
          code: "TEST_ACCESS_PENDING",
          message: "El developer token de Google Ads aún está en TEST ACCESS. Esperando aprobación de Basic Access (1-3 días hábiles).",
          connections_processed: 0,
          campaigns_inserted: 0,
          metrics_inserted: 0,
        }, 200);
      }
      if ("authError" in campRes) {
        return err("TOKEN_INVALID", "Token OAuth inválido o sin permisos. Reconectar Google Ads desde el módulo.", 401);
      }
      if ("apiError" in campRes) {
        return err("GOOGLE_ADS_API_ERROR", campRes.apiError as string, 500);
      }

      const campChunks: any[] = Array.isArray(campRes.data) ? campRes.data : [campRes.data];
      const externalToInternal = new Map<string, string>();

      for (const chunk of campChunks) {
        const rows = chunk?.results || [];
        for (const row of rows) {
          const externalId = String(row.campaign?.id);
          const dailyBudgetMicros = row.campaignBudget?.amountMicros;
          const upsertRow = {
            company_id: profile.company_id,
            connection_id: conn.id,
            platform: "google_ads",
            external_campaign_id: externalId,
            campaign_name: row.campaign?.name ?? "",
            status: mapGoogleStatus(row.campaign?.status),
            daily_budget: dailyBudgetMicros ? Number(dailyBudgetMicros) / 1_000_000 : 0,
            currency: "USD",
          };
          const { data: upserted, error: upErr } = await admin
            .from("campaigns_sync")
            .upsert(upsertRow, { onConflict: "connection_id,external_campaign_id" })
            .select("id, external_campaign_id")
            .single();
          if (upErr) {
            console.error(`${LOG_PREFIX} campaigns_sync upsert error`, upErr, upsertRow);
            continue;
          }
          externalToInternal.set(externalId, upserted.id);
          campaignsInserted++;
        }
      }

      // (d) Métricas últimos 30 días
      const metRes = await callGoogle(
        "SELECT campaign.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc FROM campaign WHERE segments.date DURING LAST_30_DAYS AND campaign.status != 'REMOVED'",
      );
      if ("pendingApproval" in metRes) {
        return json({
          success: false,
          code: "TEST_ACCESS_PENDING",
          message: "El developer token de Google Ads aún está en TEST ACCESS. Esperando aprobación de Basic Access (1-3 días hábiles).",
          connections_processed: 0,
          campaigns_inserted: campaignsInserted,
          metrics_inserted: 0,
        }, 200);
      }
      if ("authError" in metRes) {
        return err("TOKEN_INVALID", "Token OAuth inválido o sin permisos. Reconectar Google Ads desde el módulo.", 401);
      }
      if ("apiError" in metRes) {
        return err("GOOGLE_ADS_API_ERROR", metRes.apiError as string, 500);
      }

      const metChunks: any[] = Array.isArray(metRes.data) ? metRes.data : [metRes.data];
      for (const chunk of metChunks) {
        const rows = chunk?.results || [];
        for (const row of rows) {
          const externalId = String(row.campaign?.id);
          const internalId = externalToInternal.get(externalId);
          if (!internalId) {
            console.warn(`${LOG_PREFIX} métrica sin campaign mapeada`, externalId);
            continue;
          }
          const impressions = Number(row.metrics?.impressions || 0);
          const clicks = Number(row.metrics?.clicks || 0);
          const cost = Number(row.metrics?.costMicros || 0) / 1_000_000;
          const conversions = Number(row.metrics?.conversions || 0);
          const conversion_value = Number(row.metrics?.conversionsValue || 0);
          const ctr = Number(row.metrics?.ctr || 0) * 100;
          const cpc = Number(row.metrics?.averageCpc || 0) / 1_000_000;
          const cpa = cost > 0 && conversions > 0 ? cost / conversions : null;
          const roas = cost > 0 ? conversion_value / cost : null;

          const { error: mErr } = await admin.from("campaign_metrics").upsert({
            company_id: profile.company_id,
            campaign_sync_id: internalId,
            date: row.segments?.date,
            hour: null,
            impressions, clicks, ctr, cost, conversions, conversion_value, cpc, cpa, roas,
            platform_data: {
              synced_at: new Date().toISOString(),
              source: "google_ads_api_v24",
              real: true,
            },
          }, { onConflict: "campaign_sync_id,date,hour" });
          if (mErr) {
            console.error(`${LOG_PREFIX} campaign_metrics upsert error`, mErr);
            continue;
          }
          metricsInserted++;
        }
      }

      // (e) last_sync_at
      await admin.from("ad_platform_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", conn.id);

      connectionsProcessed++;
    }

    await admin.from("audit_log").insert({
      user_id: caller.id,
      user_name: `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim() || caller.email,
      action: "manual_sync",
      module: "campaign_monitor",
      company_id: profile.company_id,
      details: {
        source: "google_ads_api_v24",
        mock: false,
        connections: connections.length,
        campaigns_synced: campaignsInserted,
        metrics_synced: metricsInserted,
      },
    });

    return json({
      success: true,
      connections_processed: connectionsProcessed,
      campaigns_inserted: campaignsInserted,
      metrics_inserted: metricsInserted,
    }, 200);
  } catch (e) {
    console.error(`${LOG_PREFIX} unhandled error`, e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Error inesperado", code: "UNKNOWN" }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});