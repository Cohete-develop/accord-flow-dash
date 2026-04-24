import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, ArrowRight, Crown, LogOut } from "lucide-react";
import { toast } from "sonner";

interface TenantCard {
  id: string;
  name: string;
  domain: string;
  logo_url: string | null;
  plan: string;
  user_count: number;
  is_active: boolean;
}

export default function SuperAdminTenantsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [entering, setEntering] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const checkRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      setIsSuperAdmin(!!data);
    };
    checkRole();
  }, [user]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const loadTenants = async () => {
      const { data: companies, error } = await supabase
        .from("companies")
        .select("id, name, domain, logo_url, plan, is_active")
        .order("name");
      if (error) {
        toast.error("Error cargando tenants");
        setLoading(false);
        return;
      }
      const withCounts = await Promise.all(
        (companies || []).map(async (c) => {
          const { count } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("company_id", c.id);
          return { ...c, user_count: count || 0 } as TenantCard;
        })
      );
      setTenants(withCounts);
      setLoading(false);
    };
    loadTenants();
  }, [isSuperAdmin]);

  const handleEnter = async (tenant: TenantCard) => {
    if (!tenant.is_active) {
      toast.error("Esta empresa está inactiva");
      return;
    }
    setEntering(tenant.id);
    const { error } = await supabase.rpc("start_impersonation", {
      _target_company_id: tenant.id,
      _ua: navigator.userAgent,
    });
    if (error) {
      toast.error(`Error iniciando impersonación: ${error.message}`);
      setEntering(null);
      return;
    }
    toast.success(`Entrando como ${tenant.name}`);
    navigate("/dashboard");
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (isSuperAdmin === false) return <Navigate to="/dashboard" replace />;

  if (isSuperAdmin === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl flex items-center justify-center [background:linear-gradient(135deg,#7030A0,#4318FF)]">
              <Crown className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Consola Super Admin — Cohete</h1>
              <p className="text-muted-foreground mt-1">
                Selecciona un tenant para entrar y ver sus datos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/super-admin")}>
              Gestión de empresas
            </Button>
            <Button variant="ghost" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Salir
            </Button>
          </div>
        </div>

        {tenants.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay tenants registrados todavía.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <Card key={tenant.id} className={!tenant.is_active ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {tenant.logo_url ? (
                      <img
                        src={tenant.logo_url}
                        alt={tenant.name}
                        className="h-12 w-12 rounded-md object-contain bg-muted"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">{tenant.name}</CardTitle>
                      <CardDescription className="truncate">{tenant.domain}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="capitalize">{tenant.plan}</Badge>
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" /> {tenant.user_count}
                    </Badge>
                    {!tenant.is_active && <Badge variant="destructive">Inactiva</Badge>}
                  </div>
                  <Button
                    variant="gradient"
                    className="w-full gap-2"
                    onClick={() => handleEnter(tenant)}
                    disabled={!tenant.is_active || entering !== null}
                  >
                    {entering === tenant.id ? (
                      "Entrando..."
                    ) : (
                      <>
                        Entrar como {tenant.name}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}