import companyLogo from "@/assets/company-logo.png";
import fondoBg from "@/assets/Fondo_2026.png";
import AIChatBubble from "@/components/AIChatBubble";
import { NavLink } from "@/components/NavLink";
import Footer from "@/components/Footer";
import { Handshake, CreditCard, Package, BarChart3, LayoutDashboard, LogOut, Settings, Crown, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/acuerdos", label: "Acuerdos", icon: Handshake },
  { to: "/pagos", label: "Pagos", icon: CreditCard },
  { to: "/entregables", label: "Entregables Detalles", icon: Package },
  { to: "/kpis", label: "KPIs", icon: BarChart3 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, user, loading } = useAuth();
  const { active: impersonationActive, stop: stopImpersonation } = useImpersonation();

  const { data: layoutData, isLoading: layoutLoading } = useQuery({
    queryKey: ["layout-context", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user) return null;
      const [rolesRes, profileRes, impersonationRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('profiles').select('company_id').eq('user_id', user.id).maybeSingle(),
        supabase.rpc('get_active_impersonation', { _user_id: user.id }),
      ]);
      const roles = (rolesRes.data || []).map(r => r.role);
      const hasNoCompany = !profileRes.data?.company_id;
      const impersonating = !!impersonationRes.data;
      const cid = (impersonationRes.data as string | null) || profileRes.data?.company_id;
      let plan = '';
      if (cid) {
        const { data: comp } = await supabase
          .from('companies').select('plan').eq('id', cid).maybeSingle();
        plan = comp?.plan || '';
      }
      return {
        isGerencia: roles.includes('gerencia'),
        isSuperAdmin: roles.includes('super_admin') && hasNoCompany,
        isCoordinador: roles.includes('coordinador_mercadeo'),
        hasActiveImpersonation: impersonating,
        isPremium: ['pro', 'enterprise'].includes(plan),
      };
    },
  });

  const isGerencia = layoutData?.isGerencia ?? false;
  const isSuperAdmin = layoutData?.isSuperAdmin ?? false;
  const isCoordinador = layoutData?.isCoordinador ?? false;
  const isPremium = layoutData?.isPremium ?? false;
  const hasActiveImpersonation = layoutData?.hasActiveImpersonation ?? false;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p>Cargando...</p></div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
          <img src={companyLogo} alt="Logo empresa" className="h-16 w-auto" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">InfluXpert</h1>
            <p className="text-xs text-muted-foreground">by Cohete</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {layoutLoading ? (
            <div className="space-y-2 p-1">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <>
          {/* Módulos CRM: ocultos para super_admin sin impersonar */}
          {(!isSuperAdmin || hasActiveImpersonation) && (
            <>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
              {isPremium && (
                <NavLink
                  to="/campaign-monitor"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  <Activity className="h-4 w-4" />
                  Campaign Monitor
                </NavLink>
              )}
            </>
          )}

          {/* Administración: roles de gestión, o super_admin impersonando */}
          {(isGerencia || isCoordinador || (isSuperAdmin && hasActiveImpersonation)) && (
            <>
              <div className="my-2 border-t border-sidebar-border" />
              <NavLink
                to="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
              >
                <Settings className="h-4 w-4" />
                Administración
              </NavLink>
            </>
          )}

          {/* Super Admin: solo super_admin sin impersonar */}
          {isSuperAdmin && !hasActiveImpersonation && (
            <>
              <div className="my-2 border-t border-sidebar-border" />
              <NavLink
                to="/super-admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
              >
                <Crown className="h-4 w-4" />
                Super Admin
              </NavLink>
            </>
          )}
            </>
          )}
        </nav>
        {user && (
          <div className="p-3 border-t border-sidebar-border">
            <p className="text-xs text-muted-foreground truncate px-3 mb-2">{user.email}</p>
            {impersonationActive && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 mb-2 bg-amber-500 hover:bg-amber-400 text-amber-950 border-amber-700"
                onClick={async () => {
                  await stopImpersonation();
                  window.location.href = '/super-admin/tenants';
                }}
              >
                <LogOut className="h-4 w-4" /> Salir de impersonación
              </Button>
            )}
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        )}
      </aside>
      <main
        className="flex-1 overflow-auto bg-cover bg-center bg-no-repeat bg-fixed"
        style={{ backgroundImage: `url(${fondoBg})` }}
      >
        <div className={`p-6 w-full backdrop-blur-sm ${impersonationActive ? 'pt-16' : ''}`}>{children}</div>
        <Footer />
      </main>
      <AIChatBubble />
    </div>
  );
}
