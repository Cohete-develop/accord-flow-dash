import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";




Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  function errResp(code: string, message: string, status = 400) {
    return new Response(JSON.stringify({ error: message, code }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errResp("NOT_AUTHENTICATED", "No authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return errResp("NOT_AUTHENTICATED", "Not authenticated", 401);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    // Check for gerencia OR super_admin role
    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", caller.id)
      .in("role", ["gerencia", "super_admin"]);

    if (!roleData || roleData.length === 0)
      return errResp("FORBIDDEN", "Solo gerencia o super admin pueden crear usuarios", 403);

    const { email, password, first_name, last_name, role, company_id } = await req.json();

    if (!email || !password || !first_name || !last_name || !role)
      return errResp("MISSING_FIELDS", "Faltan campos obligatorios");

    const callerRoles = (roleData || []).map((r: any) => r.role);
    const isSuperAdmin = callerRoles.includes("super_admin");

    // Gerencia can only assign non-admin roles
    const restrictedRoles = ["gerencia", "super_admin"];
    if (!isSuperAdmin && restrictedRoles.includes(role))
      return errResp("FORBIDDEN", "No tienes permisos para asignar este rol", 403);

    // Gerencia must create users in their own company
    if (!isSuperAdmin) {
      const { data: callerProfile } = await adminClient.from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle();
      if (!callerProfile?.company_id || company_id !== callerProfile.company_id)
        return errResp("FORBIDDEN", "Solo puedes crear usuarios en tu propia empresa", 403);
    }

    // === VALIDACIÓN DE DOMINIO ===
    const emailDomain = (email.split("@")[1] || "").toLowerCase().trim();
    if (!emailDomain) return errResp("INVALID_EMAIL", "Email inválido");

    // Bloquear dominios públicos siempre
    const { data: blocked } = await adminClient.from("blocked_domains").select("domain").eq("domain", emailDomain).maybeSingle();
    if (blocked)
      return errResp("PUBLIC_DOMAIN_BLOCKED", `El dominio ${emailDomain} es público y no se permite. Usa un correo corporativo.`);

    const { data: platform } = await adminClient.from("platform_domains").select("domain").eq("domain", emailDomain).maybeSingle();
    const isPlatformDomain = !!platform;

    if (isPlatformDomain) {
      if (!isSuperAdmin)
        return errResp("PLATFORM_DOMAIN_RESERVED", `El dominio ${emailDomain} está reservado para la plataforma`, 403);
      if (role !== "super_admin")
        return errResp("PLATFORM_DOMAIN_NEEDS_SUPER_ADMIN", `Los usuarios con dominio ${emailDomain} deben tener rol super_admin`);
      if (company_id)
        return errResp("SUPER_ADMIN_NEEDS_NO_COMPANY", "Los super_admin no pueden estar asociados a una empresa");
    } else {
      if (!company_id)
        return errResp("MISSING_FIELDS", "Debes especificar la empresa para este usuario");
      const { data: targetCompany } = await adminClient.from("companies").select("domain").eq("id", company_id).maybeSingle();
      if (!targetCompany?.domain)
        return errResp("COMPANY_DOMAIN_MISSING", "La empresa destino no tiene dominio configurado");
      if (targetCompany.domain.toLowerCase() !== emailDomain)
        return errResp("DOMAIN_MISMATCH", `El email debe ser del dominio @${targetCompany.domain}`);
      if (role === "super_admin")
        return errResp("SUPER_ADMIN_REQUIRES_PLATFORM_DOMAIN", "El rol super_admin solo se asigna a usuarios del dominio plataforma");

      // === VALIDACIÓN DE LÍMITE DE LICENCIAS (max_seats) ===
      const { data: seatsCompany } = await adminClient
        .from("companies").select("max_seats, name").eq("id", company_id).maybeSingle();
      const maxSeats = seatsCompany?.max_seats ?? 0;
      const { count: activeCount } = await adminClient
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", company_id)
        .eq("is_active", true);
      if (maxSeats > 0 && (activeCount ?? 0) >= maxSeats) {
        return errResp(
          "SEATS_LIMIT_REACHED",
          `La empresa ${seatsCompany?.name || ""} ya alcanzó su límite de ${maxSeats} licencia(s) activas.`,
          409,
        );
      }
    }

    // Create user via admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, full_name: `${first_name} ${last_name}` },
    });

    if (createError) {
      const msg = createError.message || "";
      const lower = msg.toLowerCase();
      let code = "UNKNOWN";
      if (lower.includes("already been registered") || lower.includes("already registered")) code = "EMAIL_ALREADY_REGISTERED";
      else if (lower.includes("password")) code = "WEAK_PASSWORD";
      else if (lower.includes("invalid") && lower.includes("email")) code = "INVALID_EMAIL";
      return errResp(code, msg);
    }

    // Update profile with company_id
    if (company_id) {
      await adminClient.from("profiles").update({ company_id }).eq("user_id", newUser.user.id);
    }

    // Assign role
    await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role });

    // Audit log
    await adminClient.from("audit_log").insert({
      user_id: caller.id,
      user_name: `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim(),
      action: "create_user",
      module: "admin",
      company_id: company_id ?? null,
      details: { created_email: email, role },
    });

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return errResp("UNKNOWN", (err as Error).message || "Error inesperado", 500);
  }
});
