import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Vary": "Origin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", caller.id)
      .in("role", ["gerencia", "super_admin"]);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "No tienes permisos de gerencia o super admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bloqueo: no permitir borrar usuarios mientras se está impersonando
    const { data: activeImpersonation } = await adminClient
      .from("super_admin_impersonations")
      .select("id")
      .eq("super_admin_user_id", caller.id)
      .is("ended_at", null)
      .maybeSingle();
    if (activeImpersonation) {
      return new Response(JSON.stringify({ error: "No puedes eliminar usuarios mientras estás en modo impersonación. Sal del tenant primero." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, transfer_to_user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id es obligatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capturar company_id del usuario a borrar ANTES de eliminarlo (para audit log)
    const { data: targetProfilePre } = await adminClient.from("profiles").select("company_id").eq("user_id", user_id).maybeSingle();
    const targetCompanyId = targetProfilePre?.company_id ?? null;

    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "No puedes eliminarte a ti mismo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerRoles = (roleData || []).map((r: any) => r.role);
    const isSuperAdmin = callerRoles.includes("super_admin");

    // Gerencia can only delete users in their own company
    if (!isSuperAdmin) {
      const { data: callerProfile } = await adminClient.from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle();
      const { data: targetProfile } = await adminClient.from("profiles").select("company_id").eq("user_id", user_id).maybeSingle();
      if (!callerProfile?.company_id || callerProfile.company_id !== targetProfile?.company_id) {
        return new Response(JSON.stringify({ error: "Solo puedes eliminar usuarios de tu propia empresa" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Gerencia cannot delete other gerencia users
      const { data: targetRoles } = await adminClient.from("user_roles").select("role").eq("user_id", user_id);
      const targetRoleList = (targetRoles || []).map((r: any) => r.role);
      if (targetRoleList.includes("gerencia") || targetRoleList.includes("super_admin")) {
        return new Response(JSON.stringify({ error: "No tienes permisos para eliminar este usuario" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Transfer data if requested
    if (transfer_to_user_id) {
      await Promise.all([
        adminClient.from("acuerdos").update({ user_id: transfer_to_user_id }).eq("user_id", user_id),
        adminClient.from("pagos").update({ user_id: transfer_to_user_id }).eq("user_id", user_id),
        adminClient.from("entregables").update({ user_id: transfer_to_user_id }).eq("user_id", user_id),
        adminClient.from("kpis").update({ user_id: transfer_to_user_id }).eq("user_id", user_id),
      ]);
    }

    // Delete user_roles, profile, then auth user
    await adminClient.from("user_roles").delete().eq("user_id", user_id);
    await adminClient.from("profiles").delete().eq("user_id", user_id);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit (con company_id del usuario eliminado)
    await adminClient.from("audit_log").insert({
      user_id: caller.id,
      user_name: `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim(),
      action: "delete_user",
      module: "admin",
      company_id: targetCompanyId,
      details: { deleted_user_id: user_id, transferred_to: transfer_to_user_id || null },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
