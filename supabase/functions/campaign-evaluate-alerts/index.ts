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
 * Evalúa las reglas de alerta activas de la empresa del caller contra las
 * métricas más recientes del día y crea entradas en alert_history cuando
 * se cumple la condición. Channel "in_app" = solo persiste; "email"/"webhook"
 * son no-ops en mock mode.
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

    const { data: alerts } = await admin.from("campaign_alerts")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("is_active", true);

    const today = new Date().toISOString().slice(0, 10);
    let triggered = 0;

    for (const alert of alerts || []) {
      // Métricas recientes (hoy) para la(s) campaña(s) afectada(s)
      let mq = admin.from("campaign_metrics")
        .select("campaign_sync_id, ctr, cpc, cpa, roas, cost, conversions")
        .eq("company_id", profile.company_id)
        .eq("date", today);
      if (alert.campaign_sync_id) mq = mq.eq("campaign_sync_id", alert.campaign_sync_id);
      const { data: metrics } = await mq;

      for (const m of metrics || []) {
        const value = Number((m as any)[alert.metric] ?? 0);
        const threshold = Number(alert.threshold);
        let fires = false;
        if (alert.condition === "drops_below") fires = value < threshold;
        else if (alert.condition === "exceeds") fires = value > threshold;
        // changes_by_percent requeriría comparar contra histórico — omitido en mock

        if (fires) {
          await admin.from("alert_history").insert({
            company_id: profile.company_id,
            alert_id: alert.id,
            campaign_sync_id: m.campaign_sync_id,
            metric_value: value,
            threshold_value: threshold,
            message: `${alert.metric.toUpperCase()} ${alert.condition === "drops_below" ? "cayó a" : "subió a"} ${value} (umbral ${threshold})`,
          });
          await admin.from("campaign_alerts").update({ last_triggered_at: new Date().toISOString() }).eq("id", alert.id);
          triggered++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, alerts_triggered: triggered }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return err("UNKNOWN", (e as Error).message || "Error inesperado", 500);
  }
});