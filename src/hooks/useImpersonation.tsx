import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ActiveImpersonation {
  id: string;
  target_company_id: string;
  company_name: string;
  started_at: string;
}

interface ImpersonationContextType {
  active: ActiveImpersonation | null;
  loading: boolean;
  start: (companyId: string, companyName?: string) => Promise<void>;
  stop: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<ActiveImpersonation | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setActive(null); return; }
    const { data, error } = await supabase.rpc("get_my_active_impersonation");
    if (error) { setActive(null); return; }
    const row = (data as any[])?.[0];
    if (row) {
      setActive({
        id: row.id,
        target_company_id: row.target_company_id,
        company_name: row.company_name,
        started_at: row.started_at,
      });
    } else {
      setActive(null);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const start = useCallback(async (companyId: string, companyName?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("start_impersonation", {
        _target_company_id: companyId,
        _ua: navigator.userAgent,
      });
      if (error) throw error;
      await refresh();
      await qc.invalidateQueries();
      toast.success(`Entraste como ${companyName || "tenant"}`);
    } catch (e: any) {
      toast.error(e.message || "No se pudo iniciar la impersonación");
    } finally {
      setLoading(false);
    }
  }, [refresh, qc]);

  const stop = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("stop_impersonation");
      if (error) throw error;
      setActive(null);
      await qc.invalidateQueries();
      toast.success("Saliste de la impersonación");
    } catch (e: any) {
      toast.error(e.message || "No se pudo terminar la impersonación");
    } finally {
      setLoading(false);
    }
  }, [qc]);

  return (
    <ImpersonationContext.Provider value={{ active, loading, start, stop, refresh }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
