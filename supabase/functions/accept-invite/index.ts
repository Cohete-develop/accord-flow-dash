import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";



function errResp(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ error: message, code }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const isPreview = req.method === "GET";

    let token: string | null = null;
    let password: string | null = null;

    if (isPreview) {
      token = url.searchParams.get("token");
    } else {
      const body = await req.json();
      token = body.token;
      password = body.password;
    }

    if (!token) return errResp("MISSING_TOKEN", "Token requerido");

    // Buscar invitación
    const { data: invite } = await adminClient.from("invitations")
      .select("id, email, first_name, last_name, role, company_id, expires_at, accepted_at, revoked_at")
      .eq("token", token).maybeSingle();

    if (!invite) return errResp("INVITE_NOT_FOUND", "Invitación no encontrada", 404);
    if (invite.revoked_at) return errResp("INVITE_REVOKED", "Esta invitación fue revocada");
    if (invite.accepted_at) return errResp("INVITE_ALREADY_ACCEPTED", "Esta invitación ya fue usada. Inicia sesión normalmente.");
    if (new Date(invite.expires_at) < new Date()) return errResp("INVITE_EXPIRED", "Esta invitación expiró. Solicita una nueva.");

    // Buscar nombre de la empresa para el preview
    const { data: company } = await adminClient.from("companies").select("name").eq("id", invite.company_id).maybeSingle();

    // GET: solo devolver info para mostrar el formulario
    if (isPreview) {
      return new Response(JSON.stringify({
        valid: true,
        invite: {
          email: invite.email,
          first_name: invite.first_name,
          last_name: invite.last_name,
          role: invite.role,
          company_name: company?.name || "",
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST: aceptar invitación
    if (!password || password.length < 6)
      return errResp("WEAK_PASSWORD", "La contraseña debe tener al menos 6 caracteres");

    // Verificar que el email no exista todavía en auth (race con creación manual)
    const { data: existingProfile } = await adminClient.from("profiles").select("user_id").eq("email", invite.email).maybeSingle();
    if (existingProfile) return errResp("EMAIL_ALREADY_REGISTERED", "Este correo ya tiene cuenta. Inicia sesión normalmente.");

    // Crear usuario
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: invite.first_name,
        last_name: invite.last_name,
        full_name: `${invite.first_name} ${invite.last_name}`.trim(),
      },
    });
    if (createError || !newUser?.user) {
      const msg = createError?.message || "Error al crear usuario";
      const code = msg.toLowerCase().includes("already") ? "EMAIL_ALREADY_REGISTERED" : "CREATE_FAILED";
      return errResp(code, msg);
    }

    // Asociar perfil a la empresa (el trigger crea el perfil; aquí lo actualizamos)
    await adminClient.from("profiles").update({ company_id: invite.company_id }).eq("user_id", newUser.user.id);

    // Asignar rol
    await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: invite.role });

    // Marcar invitación como aceptada
    await adminClient.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

    // Audit
    await adminClient.from("audit_log").insert({
      user_id: newUser.user.id,
      user_name: `${invite.first_name} ${invite.last_name}`.trim(),
      action: "accept_invite",
      module: "auth",
      company_id: invite.company_id,
      details: { invite_id: invite.id, role: invite.role },
    });

    return new Response(JSON.stringify({ success: true, email: invite.email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return errResp("UNKNOWN", (err as Error).message || "Error inesperado", 500);
  }
});