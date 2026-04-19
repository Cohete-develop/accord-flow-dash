import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Vary": "Origin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Verify caller is super_admin
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
      .eq("role", "super_admin");

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Solo super_admin puede eliminar empresas" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id es obligatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent super_admin from deleting their own company
    const { data: callerProfile } = await adminClient
      .from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle();
    if (callerProfile?.company_id === company_id) {
      return new Response(JSON.stringify({ error: "No puedes eliminar tu propia empresa. Mueve tu cuenta a otra empresa primero." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company info for audit
    const { data: company } = await adminClient.from("companies").select("name").eq("id", company_id).maybeSingle();
    if (!company) {
      return new Response(JSON.stringify({ error: "Empresa no encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all user_ids belonging to this company
    const { data: companyProfiles } = await adminClient
      .from("profiles").select("user_id").eq("company_id", company_id);
    const allUserIds = (companyProfiles || []).map(p => p.user_id);

    // Exclude super_admin users from deletion — they are platform owners, not clients
    const { data: superAdminRoles } = await adminClient
      .from("user_roles").select("user_id").eq("role", "super_admin");
    const superAdminIds = new Set((superAdminRoles || []).map(r => r.user_id));
    const userIdsToDelete = allUserIds.filter(id => !superAdminIds.has(id));
    const superAdminIdsInCompany = allUserIds.filter(id => superAdminIds.has(id));

    // Delete in order: kpis, entregables, pagos, acuerdos (company data)
    await adminClient.from("kpis").delete().eq("company_id", company_id);
    await adminClient.from("entregables").delete().eq("company_id", company_id);
    await adminClient.from("pagos").delete().eq("company_id", company_id);
    await adminClient.from("acuerdos").delete().eq("company_id", company_id);

    // Delete audit_log entries for users to be deleted
    if (userIdsToDelete.length > 0) {
      await adminClient.from("audit_log").delete().in("user_id", userIdsToDelete);
    }

    // Delete user_roles for users to be deleted (NOT super_admins)
    if (userIdsToDelete.length > 0) {
      await adminClient.from("user_roles").delete().in("user_id", userIdsToDelete);
    }

    // Audit log BEFORE deleting users (to avoid FK violation).
    // Nota: NO seteamos company_id porque la empresa se va a borrar y el FK quedaría dangling (SET NULL).
    await adminClient.from("audit_log").insert({
      user_id: caller.id,
      user_name: `${caller.user_metadata?.first_name || ""} ${caller.user_metadata?.last_name || ""}`.trim(),
      action: "delete_company",
      module: "super_admin",
      company_id: null,
      details: { company_id, company_name: company.name, deleted_users: userIdsToDelete.length, preserved_super_admins: superAdminIdsInCompany.length },
    });

    // Unlink super_admin profiles from this company (set company_id to null) instead of deleting
    if (superAdminIdsInCompany.length > 0) {
      await adminClient.from("profiles").update({ company_id: null }).in("user_id", superAdminIdsInCompany);
    }

    // Delete profiles of non-super_admin users
    if (userIdsToDelete.length > 0) {
      await adminClient.from("profiles").delete().in("user_id", userIdsToDelete);
    }

    // Delete auth users (only non-super_admins)
    for (const uid of userIdsToDelete) {
      await adminClient.auth.admin.deleteUser(uid);
    }

    // Delete the company itself
    await adminClient.from("companies").delete().eq("id", company_id);

    return new Response(JSON.stringify({ success: true, deleted_users: userIdsToDelete.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
