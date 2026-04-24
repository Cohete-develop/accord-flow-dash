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
      .in("role", ["gerencia", "super_admin", "coordinador_mercadeo"]);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "No tienes permisos para editar usuarios" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, email, first_name, last_name, role } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id es obligatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bloqueo: no permitir cambios sensibles (email/rol) mientras se está impersonando
    if (email || role) {
      const { data: activeImpersonation } = await adminClient
        .from("super_admin_impersonations")
        .select("id")
        .eq("super_admin_user_id", caller.id)
        .is("ended_at", null)
        .maybeSingle();
      if (activeImpersonation) {
        return new Response(JSON.stringify({ error: "No puedes cambiar email o rol de usuarios mientras estás en modo impersonación. Sal del tenant primero." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const callerRoles = (roleData || []).map((r: any) => r.role);
    const isSuperAdmin = callerRoles.includes("super_admin");
    const isGerencia = callerRoles.includes("gerencia");
    const isCoordinador = callerRoles.includes("coordinador_mercadeo");

    // Get target user's current role
    const { data: targetRoleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", user_id);
    const targetRoles = (targetRoleData || []).map((r: any) => r.role);

    // Coordinador can only edit analista users
    if (isCoordinador && !isSuperAdmin && !isGerencia) {
      if (!targetRoles.includes("analista")) {
        return new Response(JSON.stringify({ error: "Solo puedes editar usuarios con rol analista" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Coordinador can only assign analista role
      if (role && role !== "analista") {
        return new Response(JSON.stringify({ error: "Solo puedes asignar el rol de analista" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Gerencia cannot assign gerencia or super_admin roles
    const restrictedRoles = ["gerencia", "super_admin"];
    if (role && !isSuperAdmin && isGerencia && restrictedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "No tienes permisos para asignar este rol" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerencia cannot edit other gerencia users
    if (isGerencia && !isSuperAdmin && targetRoles.includes("gerencia")) {
      return new Response(JSON.stringify({ error: "No puedes editar usuarios con rol de gerencia" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-super_admin can only edit users in their own company
    if (!isSuperAdmin) {
      const { data: callerProfile } = await adminClient.from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle();
      const { data: targetProfile } = await adminClient.from("profiles").select("company_id").eq("user_id", user_id).maybeSingle();
      if (!callerProfile?.company_id || callerProfile.company_id !== targetProfile?.company_id) {
        return new Response(JSON.stringify({ error: "Solo puedes editar usuarios de tu propia empresa" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update auth user
    const updatePayload: Record<string, any> = {};
    if (email) updatePayload.email = email;
    if (first_name || last_name) {
      updatePayload.user_metadata = {
        first_name: first_name || "",
        last_name: last_name || "",
        full_name: `${first_name || ""} ${last_name || ""}`.trim(),
      };
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, updatePayload);
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update profile
    const profileUpdate: Record<string, any> = {};
    if (email) profileUpdate.email = email;
    if (first_name !== undefined) profileUpdate.first_name = first_name;
    if (last_name !== undefined) profileUpdate.last_name = last_name;
    if (first_name || last_name) profileUpdate.full_name = `${first_name || ""} ${last_name || ""}`.trim();

    if (Object.keys(profileUpdate).length > 0) {
      await adminClient.from("profiles").update(profileUpdate).eq("user_id", user_id);
    }

    // Update role
    if (role) {
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("user_roles").insert({ user_id, role });
    }

    // Audit (incluir company_id del usuario editado para aislamiento por tenant)
    const { data: editedProfile } = await adminClient.from("profiles").select("company_id").eq("user_id", user_id).maybeSingle();
    await adminClient.from("audit_log").insert({
      user_id: caller.id,
      user_name: `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim(),
      action: "edit_user",
      module: "admin",
      company_id: editedProfile?.company_id ?? null,
      details: { edited_user_id: user_id, email, first_name, last_name, role },
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
