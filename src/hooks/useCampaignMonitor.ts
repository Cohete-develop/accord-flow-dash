import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext, useCompanyId } from "@/hooks/useCrmData";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export type Platform = "google_ads" | "meta_ads" | "tiktok_ads" | "linkedin_ads";

export interface AdConnection {
  id: string;
  company_id: string;
  platform: Platform;
  account_id: string;
  account_name: string;
  status: "active" | "expired" | "revoked" | "error";
  last_sync_at: string | null;
  sync_interval_minutes: number;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignSync {
  id: string;
  company_id: string;
  connection_id: string;
  platform: Platform;
  external_campaign_id: string;
  campaign_name: string;
  status: "active" | "paused" | "ended" | "draft";
  daily_budget: number;
  total_budget: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  last_sync_at: string | null;
}

export interface CampaignMetric {
  id: string;
  campaign_sync_id: string;
  date: string;
  hour: number | null;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface CampaignKeyword {
  id: string;
  campaign_sync_id: string;
  keyword: string;
  match_type: "exact" | "phrase" | "broad";
  quality_score: number | null;
  status: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface CampaignAlert {
  id: string;
  company_id: string;
  campaign_sync_id: string | null;
  created_by: string;
  metric: string;
  condition: "drops_below" | "exceeds" | "changes_by_percent";
  threshold: number;
  window_minutes: number;
  is_active: boolean;
  notify_channels: string[];
  last_triggered_at: string | null;
  created_at: string;
}

export interface AlertHistoryItem {
  id: string;
  alert_id: string;
  campaign_sync_id: string | null;
  triggered_at: string;
  metric_value: number;
  threshold_value: number;
  message: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

// Premium plan check (uses React Query so it invalidates on impersonation start/stop)
export function useIsPremium() {
  const { companyId, loading: companyLoading } = useCompanyContext();

  const { data, isLoading } = useQuery({
    queryKey: ["company_plan", companyId],
    queryFn: async () => {
      if (!companyId) return { plan: "", isPremium: false };
      const { data } = await supabase
        .from("companies")
        .select("plan")
        .eq("id", companyId)
        .maybeSingle();
      const p = data?.plan || "trial";
      return { plan: p, isPremium: ["pro", "enterprise"].includes(p) };
    },
    enabled: !!companyId && !companyLoading,
    staleTime: 30000,
  });

  return {
    plan: data?.plan || "",
    isPremium: data?.isPremium ?? null,
    loading: companyLoading || isLoading,
  };
}

export function useAdConnections() {
  const { user, loading: authLoading } = useAuth();
  const { companyId, loading: companyLoading } = useCompanyContext();
  return useQuery({
    queryKey: ["ad_connections", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_connections_safe")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AdConnection[];
    },
    enabled: !!user && !!companyId && !authLoading && !companyLoading,
  });
}

export function useCampaigns() {
  const { user, loading: authLoading } = useAuth();
  const { companyId, loading: companyLoading } = useCompanyContext();
  return useQuery({
    queryKey: ["campaigns_sync", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns_sync")
        .select("*")
        .eq("company_id", companyId)
        .order("campaign_name");
      if (error) throw error;
      return (data || []) as CampaignSync[];
    },
    enabled: !!user && !!companyId && !authLoading && !companyLoading,
  });
}

export function useCampaignMetrics(campaignId?: string, daysBack = 30) {
  const { user, loading: authLoading } = useAuth();
  const { companyId, loading: companyLoading } = useCompanyContext();
  return useQuery({
    queryKey: ["campaign_metrics", companyId, campaignId, daysBack],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - daysBack);
      const sinceStr = since.toISOString().slice(0, 10);
      // PostgREST aplica un cap (~1000) por request, así que paginamos para soportar datos horarios.
      const PAGE = 1000;
      const all: CampaignMetric[] = [];
      let from = 0;
      // Hard cap defensivo (50k filas máx) para no entrar en loop infinito.
      while (from < 50000) {
        let q = supabase
          .from("campaign_metrics")
          .select("*")
          .eq("company_id", companyId)
          .gte("date", sinceStr)
          .order("date", { ascending: true })
          .range(from, from + PAGE - 1);
        if (campaignId) q = q.eq("campaign_sync_id", campaignId);
        const { data, error } = await q;
        if (error) throw error;
        const batch = (data || []) as CampaignMetric[];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
    enabled: !!user && !!companyId && !authLoading && !companyLoading,
  });
}

export function useCampaignKeywords(campaignId?: string) {
  const { user, loading: authLoading } = useAuth();
  const { companyId, loading: companyLoading } = useCompanyContext();
  return useQuery({
    queryKey: ["campaign_keywords", companyId, campaignId],
    queryFn: async () => {
      let q = supabase.from("campaign_keywords").select("*").eq("company_id", companyId).order("clicks", { ascending: false });
      if (campaignId) q = q.eq("campaign_sync_id", campaignId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data || []) as CampaignKeyword[];
    },
    enabled: !!user && !!companyId && !authLoading && !companyLoading,
  });
}

export function useCampaignAlerts() {
  const { user, loading: authLoading } = useAuth();
  const { companyId, loading: companyLoading } = useCompanyContext();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["campaign_alerts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_alerts")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        notify_channels: Array.isArray(r.notify_channels) ? r.notify_channels : ["in_app"],
      })) as CampaignAlert[];
    },
    enabled: !!user && !!companyId && !authLoading && !companyLoading,
  });

  const save = useMutation({
    mutationFn: async (a: Partial<CampaignAlert> & { id?: string }) => {
      if (!user || !companyId) throw new Error("No company");
      const payload: any = {
        company_id: companyId,
        created_by: user.id,
        campaign_sync_id: a.campaign_sync_id || null,
        metric: a.metric,
        condition: a.condition,
        threshold: a.threshold,
        window_minutes: a.window_minutes ?? 60,
        is_active: a.is_active ?? true,
        notify_channels: a.notify_channels ?? ["in_app"],
      };
      if (a.id) {
        const { error } = await supabase.from("campaign_alerts").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaign_alerts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_alerts"] });
      toast.success("Alerta guardada");
    },
    onError: (e: any) => toast.error(e.message || "Error guardando alerta"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("campaign_alerts").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign_alerts"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_alerts"] });
      toast.success("Alerta eliminada");
    },
  });

  return { ...query, save, toggle, remove };
}

export function useAlertHistory() {
  const { user, loading: authLoading } = useAuth();
  const { companyId, loading: companyLoading } = useCompanyContext();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["alert_history", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_history")
        .select("*")
        .eq("company_id", companyId)
        .order("triggered_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as AlertHistoryItem[];
    },
    enabled: !!user && !!companyId && !authLoading && !companyLoading,
  });

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from("alert_history")
        .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert_history"] });
      toast.success("Alerta reconocida");
    },
  });

  return { ...query, acknowledge };
}

export function useSyncCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (connection_id?: string) => {
      const { data, error } = await supabase.functions.invoke("campaign-sync-data", {
        body: { connection_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns_sync"] });
      qc.invalidateQueries({ queryKey: ["campaign_metrics"] });
      qc.invalidateQueries({ queryKey: ["alert_history"] });
      toast.success("Sincronización completada");
    },
    onError: (e: any) => toast.error(e.message || "Error sincronizando"),
  });
}

export function useConnectPlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { platform: Platform; account_name: string }) => {
      const { data, error } = await supabase.functions.invoke("campaign-connect-platform", {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ad_connections"] });
      toast.success("Plataforma conectada");
    },
    onError: (e: any) => toast.error(e.message || "Error conectando"),
  });
}

export function useDisconnectPlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ad_platform_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ad_connections"] });
      toast.success("Plataforma desconectada");
    },
  });
}

/**
 * Hook para iniciar el flujo OAuth real de Google Ads.
 * - Llama a campaign-oauth-url para obtener la URL de autorización
 * - Abre una ventana popup hacia Google
 * - Cuando la ventana se cierra (o la pestaña principal vuelve a tener foco)
 *   refresca la lista de conexiones para reflejar el resultado del callback.
 */
export function useGoogleAdsOAuth() {
  const qc = useQueryClient();
  const [isLaunching, setIsLaunching] = useState(false);

  const start = async () => {
    setIsLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-oauth-url", {
        body: { platform: "google_ads" },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No se recibió la URL de autorización");

      const popup = window.open(url, "google_ads_oauth", "width=600,height=700");
      if (!popup) {
        toast.error("El navegador bloqueó la ventana emergente. Permite popups e intenta de nuevo.");
        return;
      }

      const refresh = () => {
        qc.invalidateQueries({ queryKey: ["ad_connections"] });
        qc.invalidateQueries({ queryKey: ["campaigns_sync"] });
      };

      // Detectar cierre del popup mediante polling
      const interval = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(interval);
          window.removeEventListener("focus", onFocus);
          refresh();
        }
      }, 800);

      // Refrescar también cuando la pestaña principal recupera el foco
      const onFocus = () => refresh();
      window.addEventListener("focus", onFocus);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo iniciar la conexión con Google Ads");
    } finally {
      setIsLaunching(false);
    }
  };

  return { start, isLaunching };
}
