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
 * Callback OAuth de Google Ads.
 * Recibe { code, state } desde el frontend (que los obtuvo del redirect de Google).
 * No requiere JWT (verify_jwt = false). La autenticación viene del `state`
 * almacenado previamente en oauth_states (que sí fue creado por un usuario auth).
 *
 * Pasos:
 *  1. Valida y consume el state (CSRF + identifica user_id/company_id)
 *  2. Intercambia code por access_token + refresh_token con Google
 *  3. Llama listAccessibleCustomers para obtener la cuenta
 *  4. Guarda tokens en Supabase Vault
 *  5. Crea registro en ad_platform_connections
 *  6. Audit log
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
    const redirectUri = Deno.env.get("OAUTH_REDIRECT_URI");
    const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");

    if (!clientId || !clientSecret || !redirectUri || !developerToken) {
      return err("CONFIG_MISSING", "Faltan secrets de Google Ads OAuth", 500);
    }

    const { code, state } = await req.json().catch(() => ({}));
    if (!code || !state) return err("MISSING_FIELDS", "code y state son obligatorios");

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Validar state
    const { data: stateRow, error: stateErr } = await admin
      .from("oauth_states")
      .select("id, user_id, company_id, platform, expires_at")
      .eq("state", state)
      .maybeSingle();
    if (stateErr || !stateRow) return err("INVALID_STATE", "State inválido o ya consumido", 400);
    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      await admin.from("oauth_states").delete().eq("id", stateRow.id);
      return err("STATE_EXPIRED", "El state expiró, reinicia la conexión", 400);
    }

    // Consumir state (one-time use)
    await admin.from("oauth_states").delete().eq("id", stateRow.id);

    // 2. Intercambiar code por tokens
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      return err("TOKEN_EXCHANGE_FAILED", tokenJson?.error_description || tokenJson?.error || "Error al obtener tokens", 400);
    }
    const accessToken = tokenJson.access_token as string;
    const refreshToken = tokenJson.refresh_token as string | undefined;
    const expiresIn = tokenJson.expires_in as number | undefined;
    if (!accessToken || !refreshToken) {
      return err("NO_REFRESH_TOKEN", "Google no devolvió refresh_token. Revoca acceso en tu cuenta Google y reintenta.", 400);
    }

    // 3. Listar cuentas accesibles
    const customersResp = await fetch("https://googleads.googleapis.com/v17/customers:listAccessibleCustomers", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    });
    const customersJson = await customersResp.json();
    if (!customersResp.ok) {
      return err("LIST_CUSTOMERS_FAILED", customersJson?.error?.message || "No se pudo listar cuentas de Google Ads", 400);
    }
    const resourceNames: string[] = customersJson.resourceNames || [];
    if (resourceNames.length === 0) {
      return err("NO_ACCOUNTS", "No se encontraron cuentas de Google Ads accesibles para este usuario", 400);
    }
    // resourceNames vienen como ["customers/1234567890", ...]. Tomamos la primera por defecto.
    const accountId = resourceNames[0].split("/")[1];
    const accountName = `Google Ads — ${accountId}`;

    // 4. Guardar tokens en Vault
    const vaultPayload = JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      scope: tokenJson.scope || null,
      token_type: tokenJson.token_type || "Bearer",
      account_id: accountId,
      all_accounts: resourceNames,
    });
    const vaultName = `ad_conn_google_ads_${stateRow.company_id}_${accountId}_${crypto.randomUUID()}`;
    let vaultId: string | null = null;
    try {
      const { data: vaultRes, error: vaultErr } = await admin.rpc("vault.create_secret" as any, {
        secret: vaultPayload,
        name: vaultName,
      } as any);
      if (vaultErr) throw vaultErr;
      vaultId = (vaultRes as any) ?? null;
    } catch (vaultExc) {
      console.error("Vault store failed:", vaultExc);
      return err("VAULT_FAILED", "No se pudieron almacenar los tokens de forma segura. Contacta al administrador.", 500);
    }

    // 5. Crear conexión
    const { data: conn, error: insertErr } = await admin.from("ad_platform_connections").insert({
      company_id: stateRow.company_id,
      platform: "google_ads",
      account_id: accountId,
      account_name: accountName,
      credentials_vault_id: vaultId,
      status: "active",
      connected_by: stateRow.user_id,
      last_sync_at: new Date().toISOString(),
    }).select().single();
    if (insertErr) return err("INSERT_FAILED", insertErr.message, 500);

    // 6. Audit log
    const { data: callerProfile } = await admin
      .from("profiles").select("full_name, email")
      .eq("user_id", stateRow.user_id).maybeSingle();
    await admin.from("audit_log").insert({
      user_id: stateRow.user_id,
      user_name: callerProfile?.full_name || callerProfile?.email || "unknown",
      action: "oauth_connect_platform",
      module: "campaign_monitor",
      company_id: stateRow.company_id,
      details: { platform: "google_ads", account_id: accountId, connection_id: conn.id, accounts_available: resourceNames.length },
    });

    return new Response(JSON.stringify({
      success: true,
      account_id: accountId,
      account_name: accountName,
      connection_id: conn.id,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("oauth-callback error:", e);
    return err("UNKNOWN", (e as Error).message || "Error inesperado", 500);
  }
});