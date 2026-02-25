import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { user_id, email, first_name, last_name, role } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id es obligatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerRoles = (roleData || []).map((r: any) => r.role);
    const isSuperAdmin = callerRoles.includes("super_admin");

    // Gerencia cannot assign gerencia or super_admin roles
    const restrictedRoles = ["gerencia", "super_admin"];
    if (role && !isSuperAdmin && restrictedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "No tienes permisos para asignar este rol" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerencia can only edit users in their own company
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

    // Audit
    await adminClient.from("audit_log").insert({
      user_id: caller.id,
      user_name: `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim(),
      action: "edit_user",
      module: "admin",
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
