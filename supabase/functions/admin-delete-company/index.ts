// redeploy 2026-04-25
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";



Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  console.log('[admin-delete-company] invoked v2', new Date().toISOString());

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id es obligatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cascade delete en una sola transacción SQL (rápido y atómico)
    const { data: rpcResult, error: rpcError } = await callerClient.rpc(
      "admin_cascade_delete_company",
      { _company_id: company_id }
    );

    if (rpcError) {
      console.error('[admin-delete-company] rpc error', rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Borrar de auth.users en paralelo (requiere admin client)
    const userIdsToDelete: string[] = (rpcResult?.users_to_delete_from_auth as string[]) || [];
    const deletePromises = userIdsToDelete.map(uid => adminClient.auth.admin.deleteUser(uid));
    const deleteResults = await Promise.allSettled(deletePromises);
    const failedAuthDeletes = deleteResults.filter((result) => result.status === 'rejected');

    if (failedAuthDeletes.length > 0) {
      console.error('[admin-delete-company] auth deletion failures', failedAuthDeletes.length);
    }

    return new Response(JSON.stringify({
      success: true,
      company_name: rpcResult?.company_name,
      deleted_users: userIdsToDelete.length,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error('[admin-delete-company] unexpected error', err);
    return new Response(JSON.stringify({ error: err?.message || "Error inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
