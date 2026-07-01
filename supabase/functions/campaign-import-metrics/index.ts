import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const LOG_PREFIX = "[campaign-import-metrics]";
const VALID_PLATFORMS = ["google_ads", "meta_ads", "tiktok_ads", "linkedin_ads"];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const err = (code: string, message: string, status = 400) =>
    json({ ok: false, error: message, code }, status);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("NOT_AUTHENTICATED", "No authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return err("NOT_AUTHENTICATED", "Not authenticated", 401);

    // Payload
    let body: any = {};
    try { body = await req.json(); } catch { return err("BAD_JSON", "Body no es JSON válido", 400); }
    const platform = String(body.platform || "");
    const periodStart = String(body.period_start || "");
    const periodEnd = String(body.period_end || "");
    const rows = body.rows;
    const dryRun = body.dry_run === true;

    if (!VALID_PLATFORMS.includes(platform)) {
      return err("INVALID_PLATFORM", `platform debe ser uno de: ${VALID_PLATFORMS.join(", ")}`, 400);
    }
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      return err("INVALID_PERIOD", "period_start/period_end inválidos", 400);
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return err("EMPTY_ROWS", "rows debe ser un array no vacío", 400);
    }

    // Gating: resolve company + plan
    const { data: companyId, error: companyErr } = await callerClient.rpc(
      "get_user_company_id",
      { _user_id: caller.id },
    );
    if (companyErr || !companyId) {
      console.error(`${LOG_PREFIX} get_user_company_id`, companyErr);
      return err("NO_COMPANY", "Usuario sin empresa asociada", 403);
    }

    const { data: limits, error: limitsErr } = await callerClient.rpc(
      "get_company_plan_limits",
      { _company_id: companyId },
    );
    if (limitsErr || !limits || limits.length === 0) {
      console.error(`${LOG_PREFIX} get_company_plan_limits`, limitsErr);
      return err("NO_PLAN", "Plan no configurado", 403);
    }
    const modules: string[] = limits[0].modules_included || [];
    if (!modules.includes("campaign_monitor")) {
      return err(
        "PLAN_REQUIRED",
        "Campaign Monitor no está incluido en tu plan actual",
        403,
      );
    }

    // Execute import (transactional inside the RPC)
    const { data: result, error: rpcErr } = await callerClient.rpc(
      "import_campaign_metrics",
      {
        _platform: platform,
        _period_start: periodStart,
        _period_end: periodEnd,
        _rows: rows,
        _dry_run: dryRun,
      },
    );
    if (rpcErr) {
      console.error(`${LOG_PREFIX} import_campaign_metrics`, rpcErr);
      return err("IMPORT_FAILED", rpcErr.message || "Error al importar", 500);
    }

    // Dry run: return preview payload as-is without audit logging
    if (dryRun) {
      return json({ ok: true, ...(result as any) }, 200);
    }

    const inserted = Number((result as any)?.inserted ?? 0);
    const updated = Number((result as any)?.updated ?? 0);
    const skipped = Number((result as any)?.skipped ?? 0);
    const campaignsTouched = Number((result as any)?.campaigns_touched ?? 0);
    const rowsReceived = Number((result as any)?.rows_received ?? 0);

    // Audit log (fail-open)
    try {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from("audit_log").insert({
        user_id: caller.id,
        user_name:
          `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim() ||
          caller.email,
        action: "campaign_manual_import",
        module: "campaign_monitor",
        company_id: companyId,
        details: {
          platform,
          period_start: periodStart,
          period_end: periodEnd,
          rows_received: rows.length,
          inserted,
          updated,
          skipped,
          campaigns_touched: campaignsTouched,
        },
      });
    } catch (auditErr) {
      console.error(`${LOG_PREFIX} audit_log insert failed`, auditErr);
    }

    return json({
      ok: true,
      platform,
      inserted,
      updated,
      skipped,
      rows_received: rowsReceived,
      campaigns_touched: campaignsTouched,
    }, 200);
  } catch (e) {
    console.error(`${LOG_PREFIX} unhandled`, e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message || "Error inesperado", code: "UNKNOWN" }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      },
    );
  }
});