import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";




/**
 * MOCK MODE — Campaign Monitor Phase 1
 * Crea una conexión "demo" sin OAuth real. Cuando se implemente OAuth real,
 * esta función intercambiará el authorization_code por tokens y los guardará
 * en Supabase Vault (vault.create_secret) referenciados desde credentials_vault_id.
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  function err(code: string, message: string, status = 400) {
    return new Response(JSON.stringify({ error: message, code }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

    // Validar rol
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
    const roleList = (roles || []).map((r: any) => r.role);
    const canConnect = roleList.includes("gerencia") || roleList.includes("coordinador_mercadeo") || roleList.includes("super_admin");
    if (!canConnect) return err("FORBIDDEN", "Solo gerencia o coordinador de mercadeo pueden conectar plataformas", 403);

    // Validar plan premium y límites
    const { data: profile } = await admin.from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle();
    if (!profile?.company_id) return err("NO_COMPANY", "Usuario sin empresa asociada", 403);

    const { data: limits } = await admin.rpc("get_company_plan_limits", { _company_id: profile.company_id });
    if (!limits || limits.length === 0) return err("NO_PLAN", "Plan no configurado para esta empresa", 400);
    const planLimits = limits[0] as {
      plan_id: string;
      max_ad_connections: number;
      modules_included: string[];
    };
    if (!planLimits.modules_included?.includes("campaign_monitor")) {
      return err("PLAN_REQUIRED", "Campaign Monitor no está incluido en tu plan actual", 403);
    }

    const { count: activeConnections } = await admin
      .from("ad_platform_connections")
      .select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "active");

    if ((activeConnections ?? 0) >= (planLimits.max_ad_connections ?? 0)) {
      return err(
        "CONNECTION_LIMIT",
        `Tu plan ${planLimits.plan_id} permite máximo ${planLimits.max_ad_connections} conexiones. Actualiza tu plan para conectar más plataformas.`,
        403
      );
    }

    const { platform, account_id, account_name } = await req.json();
    if (!platform || !account_id) return err("MISSING_FIELDS", "platform y account_id son obligatorios");
    if (!["google_ads", "meta_ads", "tiktok_ads", "linkedin_ads", "webhook"].includes(platform))
      return err("INVALID_PLATFORM", "Plataforma no soportada");

    // MOCK: en producción aquí se intercambia oauth_code → tokens y se guarda en Vault.
    // const { data: vaultRes } = await admin.rpc("vault.create_secret", { secret: JSON.stringify(tokens), name: `ad_conn_${crypto.randomUUID()}` });
    const { data: conn, error: insertErr } = await admin.from("ad_platform_connections").insert({
      company_id: profile.company_id,
      platform,
      account_id,
      account_name: account_name || `${platform} — ${account_id}`,
      credentials_vault_id: null, // mock
      status: "active",
      connected_by: caller.id,
      last_sync_at: new Date().toISOString(),
    }).select().single();
    if (insertErr) return err("INSERT_FAILED", insertErr.message);

    await admin.from("audit_log").insert({
      user_id: caller.id,
      user_name: `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim() || caller.email,
      action: "connect_platform",
      module: "campaign_monitor",
      company_id: profile.company_id,
      details: { platform, account_id, connection_id: conn.id, mock: true },
    });

    return new Response(JSON.stringify({ success: true, connection: conn }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return err("UNKNOWN", (e as Error).message || "Error inesperado", 500);
  }
});