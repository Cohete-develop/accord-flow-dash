import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";



function err(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ error: message, code }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * MOCK MODE — Campaign Monitor Phase 1
 * Genera métricas sintéticas para "hoy" en cada campaña activa de la empresa
 * del caller. En producción aquí se llamaría a Google Ads / Meta APIs usando
 * los tokens descifrados del Vault.
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("NOT_AUTHENTICATED", "No authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return err("NOT_AUTHENTICATED", "Not authenticated", 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin.from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle();
    if (!profile?.company_id) return err("NO_COMPANY", "Usuario sin empresa asociada", 403);

    // Validar plan premium y límites de campañas sincronizadas
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
        403
      );
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* GET-style invocation */ }
    const connectionId = body.connection_id as string | undefined;

    // SIEMPRE filtrar por company_id del caller (defensa en profundidad)
    let connQuery = admin.from("ad_platform_connections")
      .select("id, platform")
      .eq("company_id", profile.company_id)
      .eq("status", "active");
    if (connectionId) connQuery = connQuery.eq("id", connectionId);
    const { data: connections } = await connQuery;
    if (!connections || connections.length === 0) return err("NO_CONNECTIONS", "No hay conexiones activas para sincronizar", 404);

    const today = new Date().toISOString().slice(0, 10);
    let metricsInserted = 0;

    for (const conn of connections) {
      const { data: campaigns } = await admin.from("campaigns_sync")
        .select("id, daily_budget, platform")
        .eq("connection_id", conn.id)
        .eq("company_id", profile.company_id)
        .eq("status", "active");

      for (const camp of campaigns || []) {
        const impressions = 3000 + Math.floor(Math.random() * 4000) + (camp.platform === "meta_ads" ? 2000 : 0);
        const clicks = 80 + Math.floor(Math.random() * 180);
        const cost = Number((Number(camp.daily_budget) * (0.7 + Math.random() * 0.5)).toFixed(2));
        const conversions = 3 + Math.floor(Math.random() * 15);
        const conversion_value = Number(((50 + Math.random() * 350) * conversions).toFixed(2));
        const ctr = Number(((clicks / impressions) * 100).toFixed(2));
        const cpc = Number((cost / clicks).toFixed(2));
        const cpa = Number((cost / conversions).toFixed(2));
        const roas = Number((conversion_value / cost).toFixed(2));

        await admin.from("campaign_metrics").upsert({
          company_id: profile.company_id,
          campaign_sync_id: camp.id,
          date: today,
          hour: null,
          impressions, clicks, ctr, cost, conversions, conversion_value, cpc, cpa, roas,
          platform_data: { mock: true, synced_at: new Date().toISOString() },
        }, { onConflict: "campaign_sync_id,date,hour" });
        metricsInserted++;
      }

      await admin.from("ad_platform_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", conn.id);
    }

    await admin.from("audit_log").insert({
      user_id: caller.id,
      user_name: `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim() || caller.email,
      action: "manual_sync",
      module: "campaign_monitor",
      company_id: profile.company_id,
      details: { connections: connections.length, metrics_upserted: metricsInserted, mock: true },
    });

    return new Response(JSON.stringify({ success: true, connections: connections.length, metrics_upserted: metricsInserted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return err("UNKNOWN", (e as Error).message || "Error inesperado", 500);
  }
});