import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyId } from "@/hooks/useCrmData";
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

// Premium plan check
export function useIsPremium() {
  const companyId = useCompanyId();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<string>("");

  useEffect(() => {
    if (!companyId) {
      setIsPremium(false);
      return;
    }
    supabase.from("companies").select("plan").eq("id", companyId).maybeSingle()
      .then(({ data }) => {
        const p = data?.plan || "trial";
        setPlan(p);
        setIsPremium(["pro", "enterprise"].includes(p));
      });
  }, [companyId]);

  return { isPremium, plan, loading: isPremium === null };
}

export function useAdConnections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ad_connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_connections_safe")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AdConnection[];
    },
    enabled: !!user,
  });
}

export function useCampaigns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["campaigns_sync"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns_sync")
        .select("*")
        .order("campaign_name");
      if (error) throw error;
      return (data || []) as CampaignSync[];
    },
    enabled: !!user,
  });
}

export function useCampaignMetrics(campaignId?: string, daysBack = 30) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["campaign_metrics", campaignId, daysBack],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - daysBack);
      let q = supabase
        .from("campaign_metrics")
        .select("*")
        .gte("date", since.toISOString().slice(0, 10))
        .order("date", { ascending: true });
      if (campaignId) q = q.eq("campaign_sync_id", campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CampaignMetric[];
    },
    enabled: !!user,
  });
}

export function useCampaignKeywords(campaignId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["campaign_keywords", campaignId],
    queryFn: async () => {
      let q = supabase.from("campaign_keywords").select("*").order("clicks", { ascending: false });
      if (campaignId) q = q.eq("campaign_sync_id", campaignId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data || []) as CampaignKeyword[];
    },
    enabled: !!user,
  });
}

export function useCampaignAlerts() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["campaign_alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        notify_channels: Array.isArray(r.notify_channels) ? r.notify_channels : ["in_app"],
      })) as CampaignAlert[];
    },
    enabled: !!user,
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
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["alert_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_history")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as AlertHistoryItem[];
    },
    enabled: !!user,
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
