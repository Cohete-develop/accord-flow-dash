import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";




/**
 * Genera la URL de autorización OAuth de Google Ads.
 * - Valida rol (gerencia / coordinador_mercadeo / super_admin)
 * - Valida plan premium y límite de conexiones
 * - Crea un `state` en oauth_states (CSRF protection, expira en 10 min)
 * - Construye la URL de Google OAuth con scope adwords
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
    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
    const redirectUri = Deno.env.get("OAUTH_REDIRECT_URI");
    if (!clientId || !redirectUri) {
      return err("CONFIG_MISSING", "GOOGLE_ADS_CLIENT_ID u OAUTH_REDIRECT_URI no configurados", 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return err("NOT_AUTHENTICATED", "Not authenticated", 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Validar rol
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
    const roleList = (roles || []).map((r: any) => r.role);
    const canConnect = roleList.includes("gerencia")
      || roleList.includes("coordinador_mercadeo")
      || roleList.includes("super_admin");
    if (!canConnect) {
      return err("FORBIDDEN", "Solo gerencia o coordinador de mercadeo pueden conectar plataformas", 403);
    }

    // Empresa del caller
    const { data: profile } = await admin.from("profiles")
      .select("company_id").eq("user_id", caller.id).maybeSingle();
    if (!profile?.company_id) return err("NO_COMPANY", "Usuario sin empresa asociada", 403);

    // Validar plan premium y límites
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

    const body = await req.json().catch(() => ({}));
    const platform = (body?.platform || "google_ads") as string;
    if (platform !== "google_ads") {
      return err("UNSUPPORTED_PLATFORM", "Solo google_ads soporta OAuth real por ahora", 400);
    }

    // Limpiar states expirados de este usuario (housekeeping)
    await admin.from("oauth_states").delete().lt("expires_at", new Date().toISOString());

    // Crear state nuevo
    const { data: stateRow, error: stateErr } = await admin.from("oauth_states").insert({
      user_id: caller.id,
      company_id: profile.company_id,
      platform,
    }).select("state").single();
    if (stateErr || !stateRow) return err("STATE_FAILED", stateErr?.message || "No se pudo crear el state", 500);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/adwords",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: stateRow.state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return err("UNKNOWN", (e as Error).message || "Error inesperado", 500);
  }
});