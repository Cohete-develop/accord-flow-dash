import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import AcuerdosPage from "./pages/Acuerdos";
import PagosPage from "./pages/Pagos";
import EntregablesPage from "./pages/Entregables";
import KPIsPage from "./pages/KPIs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/acuerdos" replace />} />
            <Route path="/acuerdos" element={<AcuerdosPage />} />
            <Route path="/pagos" element={<PagosPage />} />
            <Route path="/entregables" element={<EntregablesPage />} />
            <Route path="/kpis" element={<KPIsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
