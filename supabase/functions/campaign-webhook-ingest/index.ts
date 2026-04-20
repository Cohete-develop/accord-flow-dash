import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Vary": "Origin",
};

function err(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ error: message, code }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Webhook público para ingestar métricas desde n8n / Zapier / scripts externos.
 * NO usa JWT de Supabase — autentica con un API key único por conexión enviado
 * en el header `x-api-key`. La conexión debe ser de tipo platform='webhook'.
 *
 * Payload esperado:
 * {
 *   external_campaign_id: string,
 *   campaign_name: string,
 *   date: "YYYY-MM-DD",
 *   metrics: { impressions, clicks, cost, conversions, conversion_value? },
 *   keywords?: [...]
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("METHOD_NOT_ALLOWED", "Use POST", 405);

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return err("MISSING_API_KEY", "Falta header x-api-key", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // En producción: hash bcrypt del API key. En mock guardamos el plain en account_id por simplicidad.
    const { data: conn } = await admin.from("ad_platform_connections")
      .select("id, company_id, status")
      .eq("platform", "webhook")
      .eq("account_id", apiKey)
      .maybeSingle();
    if (!conn || conn.status !== "active") return err("INVALID_API_KEY", "API key inválido o conexión inactiva", 401);

    const body = await req.json();
    const { external_campaign_id, campaign_name, date, metrics, keywords } = body;
    if (!external_campaign_id || !campaign_name || !date || !metrics)
      return err("INVALID_PAYLOAD", "Faltan campos: external_campaign_id, campaign_name, date, metrics");

    // Upsert campaña
    const { data: camp } = await admin.from("campaigns_sync").upsert({
      company_id: conn.company_id,
      connection_id: conn.id,
      platform: "webhook",
      external_campaign_id,
      campaign_name,
      status: "active",
      last_sync_at: new Date().toISOString(),
    }, { onConflict: "connection_id,external_campaign_id" }).select().single();

    if (!camp) return err("UPSERT_FAILED", "No se pudo guardar la campaña");

    const impressions = Number(metrics.impressions || 0);
    const clicks = Number(metrics.clicks || 0);
    const cost = Number(metrics.cost || 0);
    const conversions = Number(metrics.conversions || 0);
    const conversion_value = Number(metrics.conversion_value || 0);

    await admin.from("campaign_metrics").upsert({
      company_id: conn.company_id,
      campaign_sync_id: camp.id,
      date,
      hour: null,
      impressions, clicks,
      ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
      cost, conversions, conversion_value,
      cpc: clicks > 0 ? Number((cost / clicks).toFixed(2)) : 0,
      cpa: conversions > 0 ? Number((cost / conversions).toFixed(2)) : 0,
      roas: cost > 0 ? Number((conversion_value / cost).toFixed(2)) : 0,
      platform_data: { source: "webhook" },
    }, { onConflict: "campaign_sync_id,date,hour" });

    if (Array.isArray(keywords)) {
      for (const k of keywords) {
        await admin.from("campaign_keywords").insert({
          company_id: conn.company_id,
          campaign_sync_id: camp.id,
          keyword: k.keyword,
          match_type: k.match_type || "broad",
          quality_score: k.quality_score || null,
          status: k.status || "active",
          date,
          impressions: k.impressions || 0,
          clicks: k.clicks || 0,
          cost: k.cost || 0,
          conversions: k.conversions || 0,
          ctr: (k.impressions || 0) > 0 ? Number(((k.clicks || 0) / k.impressions * 100).toFixed(2)) : 0,
          cpc: (k.clicks || 0) > 0 ? Number(((k.cost || 0) / k.clicks).toFixed(2)) : 0,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, campaign_id: camp.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return err("UNKNOWN", (e as Error).message || "Error inesperado", 500);
  }
});