import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function RoleBasedRedirect() {
  const { user, loading } = useAuth();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    const check = async () => {
      // Si hay impersonación activa, ir al dashboard del tenant
      const { data: imp } = await supabase.rpc("get_active_impersonation", { _user_id: user.id });
      if (imp) {
        setTarget("/dashboard");
        return;
      }

      // Si es super_admin, ir al selector de tenants
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      setTarget(role ? "/super-admin/tenants" : "/dashboard");
    };

    check();
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!target) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }
  return <Navigate to={target} replace />;
}