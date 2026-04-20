import type { CampaignMetric, CampaignSync, Platform } from "@/hooks/useCampaignMonitor";

export const PLATFORM_LABELS: Record<Platform, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
  linkedin_ads: "LinkedIn Ads",
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  google_ads: "hsl(217 91% 60%)",
  meta_ads: "hsl(262 83% 58%)",
  tiktok_ads: "hsl(340 82% 52%)",
  linkedin_ads: "hsl(199 89% 48%)",
};

export const fmtMoney = (n: number) =>
  `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
export const fmtNum = (n: number) => (n || 0).toLocaleString("en-US");
export const fmtPct = (n: number) => `${(n || 0).toFixed(2)}%`;

export interface MetricTotals {
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export function aggregate(metrics: CampaignMetric[]): MetricTotals {
  const t = metrics.reduce(
    (acc, m) => ({
      cost: acc.cost + Number(m.cost),
      impressions: acc.impressions + Number(m.impressions),
      clicks: acc.clicks + Number(m.clicks),
      conversions: acc.conversions + Number(m.conversions),
      conversion_value: acc.conversion_value + Number(m.conversion_value),
    }),
    { cost: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }
  );
  return {
    ...t,
    ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
    cpc: t.clicks > 0 ? t.cost / t.clicks : 0,
    cpa: t.conversions > 0 ? t.cost / t.conversions : 0,
    roas: t.cost > 0 ? t.conversion_value / t.cost : 0,
  };
}

export function aggregateByCampaign(
  metrics: CampaignMetric[],
  campaigns: CampaignSync[]
): Array<CampaignSync & MetricTotals> {
  const byId = new Map<string, CampaignMetric[]>();
  metrics.forEach((m) => {
    const arr = byId.get(m.campaign_sync_id) || [];
    arr.push(m);
    byId.set(m.campaign_sync_id, arr);
  });
  return campaigns.map((c) => ({ ...c, ...aggregate(byId.get(c.id) || []) }));
}

export function aggregateByPlatform(
  metrics: CampaignMetric[],
  campaigns: CampaignSync[]
): Array<{ platform: Platform } & MetricTotals> {
  const platMap = new Map<string, Platform>();
  campaigns.forEach((c) => platMap.set(c.id, c.platform));
  const groups = new Map<Platform, CampaignMetric[]>();
  metrics.forEach((m) => {
    const p = platMap.get(m.campaign_sync_id);
    if (!p) return;
    const arr = groups.get(p) || [];
    arr.push(m);
    groups.set(p, arr);
  });
  return Array.from(groups.entries()).map(([platform, ms]) => ({
    platform,
    ...aggregate(ms),
  }));
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function filterByDays(metrics: CampaignMetric[], days: number, offsetDays = 0): CampaignMetric[] {
  const end = new Date();
  end.setDate(end.getDate() - offsetDays);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  return metrics.filter((m) => m.date > startStr && m.date <= endStr);
}