import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";




Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  function errResp(code: string, message: string, status = 400) {
    return new Response(JSON.stringify({ error: message, code }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errResp("NOT_AUTHENTICATED", "No authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return errResp("NOT_AUTHENTICATED", "Not authenticated", 401);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", caller.id);
    const callerRoles = (roles || []).map((r: any) => r.role);
    const isSuperAdmin = callerRoles.includes("super_admin");
    const isGerencia = callerRoles.includes("gerencia");
    if (!isSuperAdmin && !isGerencia)
      return errResp("FORBIDDEN", "Solo gerencia o super admin pueden invitar usuarios", 403);

    const body = await req.json();
    const { email, first_name, last_name, role, company_id } = body;
    if (!email || !first_name || !last_name || !role || !company_id)
      return errResp("MISSING_FIELDS", "Faltan campos obligatorios");

    // Restricciones de rol
    if (!isSuperAdmin && (role === "super_admin" || role === "gerencia"))
      return errResp("FORBIDDEN", "No tienes permisos para asignar este rol", 403);

    // Gerencia solo invita a su propia empresa
    if (!isSuperAdmin) {
      const { data: callerProfile } = await adminClient.from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle();
      if (!callerProfile?.company_id || company_id !== callerProfile.company_id)
        return errResp("FORBIDDEN", "Solo puedes invitar a tu propia empresa", 403);
    }

    const emailDomain = (email.split("@")[1] || "").toLowerCase().trim();
    if (!emailDomain) return errResp("INVALID_EMAIL", "Email inválido");

    // Bloquear dominios públicos
    const { data: blocked } = await adminClient.from("blocked_domains").select("domain").eq("domain", emailDomain).maybeSingle();
    if (blocked) return errResp("PUBLIC_DOMAIN_BLOCKED", `El dominio ${emailDomain} es público y no se permite. Usa un correo corporativo.`);

    // Validar dominio coincide con la empresa
    const { data: company } = await adminClient.from("companies").select("name, domain, max_seats").eq("id", company_id).maybeSingle();
    if (!company) return errResp("COMPANY_NOT_FOUND", "Empresa no encontrada", 404);
    if (!company.domain) return errResp("COMPANY_DOMAIN_MISSING", "La empresa destino no tiene dominio configurado");
    if (company.domain.toLowerCase() !== emailDomain)
      return errResp("DOMAIN_MISMATCH", `El email debe ser del dominio @${company.domain}`);

    // Validar email no registrado
    const { data: existingProfile } = await adminClient.from("profiles").select("user_id").eq("email", email.toLowerCase()).maybeSingle();
    if (existingProfile) return errResp("EMAIL_ALREADY_REGISTERED", "Este correo ya tiene una cuenta activa");

    // Validar invitación pendiente
    const { data: pending } = await adminClient.from("invitations")
      .select("id, expires_at, accepted_at, revoked_at")
      .eq("email", email.toLowerCase())
      .eq("company_id", company_id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (pending) return errResp("INVITE_ALREADY_PENDING", "Ya existe una invitación pendiente para este correo. Revócala antes de crear una nueva.");

    // Validar max_seats: activos + invitaciones pendientes
    const maxSeats = company.max_seats ?? 0;
    const { count: activeCount } = await adminClient.from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("company_id", company_id).eq("is_active", true);
    const { count: pendingCount } = await adminClient.from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company_id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());
    const used = (activeCount ?? 0) + (pendingCount ?? 0);
    if (maxSeats > 0 && used >= maxSeats)
      return errResp("SEATS_LIMIT_REACHED", `La empresa ${company.name} ya alcanzó su límite de ${maxSeats} licencia(s) entre activos e invitaciones pendientes.`, 409);

    // Crear la invitación
    const { data: invite, error: insertError } = await adminClient.from("invitations").insert({
      email: email.toLowerCase(),
      first_name,
      last_name,
      role,
      company_id,
      invited_by: caller.id,
    }).select().single();
    if (insertError) return errResp("INSERT_FAILED", insertError.message);

    // Audit log
    await adminClient.from("audit_log").insert({
      user_id: caller.id,
      user_name: `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim() || caller.email,
      action: "invite_user",
      module: "admin",
      company_id,
      details: { email, role, invite_id: invite.id },
    });

    // El frontend construirá la URL completa con su origin
    return new Response(JSON.stringify({
      success: true,
      invite: {
        id: invite.id,
        token: invite.token,
        email: invite.email,
        first_name: invite.first_name,
        last_name: invite.last_name,
        role: invite.role,
        expires_at: invite.expires_at,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return errResp("UNKNOWN", (err as Error).message || "Error inesperado", 500);
  }
});