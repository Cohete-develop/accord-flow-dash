import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

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

    // Validar plan premium
    const { data: company } = await admin.from("companies").select("plan").eq("id", profile.company_id).maybeSingle();
    if (!["pro", "enterprise"].includes(company?.plan || "")) {
      return err("PLAN_REQUIRED", "Campaign Monitor requiere plan Pro o Enterprise", 403);
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