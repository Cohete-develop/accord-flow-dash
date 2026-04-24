import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ImpersonationProvider } from "@/hooks/useImpersonation";
import Layout from "@/components/Layout";
import DashboardPage from "./pages/Dashboard";
import AcuerdosPage from "./pages/Acuerdos";
import PagosPage from "./pages/Pagos";
import EntregablesPage from "./pages/Entregables";
import KPIsPage from "./pages/KPIs";
import AdminPage from "./pages/Admin";
import SuperAdminPage from "./pages/SuperAdmin";
import CampaignMonitorPage from "./pages/CampaignMonitor";
import AuthPage from "./pages/Auth";
import OAuthCallbackPage from "./pages/OAuthCallback";
import ResetPasswordPage from "./pages/ResetPassword";
import AcceptInvitePage from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ImpersonationProvider>
            <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Layout><DashboardPage /></Layout>} />
            <Route path="/acuerdos" element={<Layout><AcuerdosPage /></Layout>} />
            <Route path="/pagos" element={<Layout><PagosPage /></Layout>} />
            <Route path="/entregables" element={<Layout><EntregablesPage /></Layout>} />
            <Route path="/kpis" element={<Layout><KPIsPage /></Layout>} />
            <Route path="/admin" element={<Layout><AdminPage /></Layout>} />
            <Route path="/super-admin" element={<Layout><SuperAdminPage /></Layout>} />
            <Route path="/campaign-monitor" element={<Layout><CampaignMonitorPage /></Layout>} />
            <Route path="/campaign-monitor/oauth/callback" element={<OAuthCallbackPage />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </ImpersonationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
