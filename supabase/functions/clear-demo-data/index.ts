import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Solo super_admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: companyId } = await admin.rpc("get_active_impersonation", {
      _user_id: user.id,
    });

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "Debe estar impersonando un tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Borrar en orden inverso a las FKs
    const tablesInOrder = [
      "alert_history",
      "campaign_alerts",
      "campaign_keywords",
      "campaign_metrics",
      "campaigns_sync",
      "ad_platform_connections",
      "kpis",
      "pagos",
      "entregables",
      "acuerdos",
    ];

    const deletedCounts: Record<string, number> = {};

    for (const table of tablesInOrder) {
      const { count, error } = await admin
        .from(table)
        .delete({ count: "exact" })
        .eq("company_id", companyId)
        .eq("is_demo_data", true);

      if (error) {
        console.error(`Error limpiando ${table}:`, error);
      }
      deletedCounts[table] = count || 0;
    }

    await admin.from("audit_log").insert({
      user_id: user.id,
      user_name: user.email || "super_admin",
      action: "DEMO_DATA_CLEARED",
      module: "super_admin",
      company_id: companyId,
      details: { target_company_id: companyId, deleted: deletedCounts },
    });

    return new Response(JSON.stringify({ success: true, deleted: deletedCounts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});