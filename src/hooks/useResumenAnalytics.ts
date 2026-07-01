import { useMemo } from "react";
import {
  useCampaigns,
  useCampaignMetrics,
  type CampaignMetric,
  type CampaignSync,
  type Platform,
} from "@/hooks/useCampaignMonitor";
import { aggregate, aggregateByPlatform, pctChange, type MetricTotals } from "@/components/campaign-monitor/utils";

// ---------- Types ----------

export interface DailyPoint {
  date: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  revenue: number;
  roas: number;
}

export interface PlatformSeries {
  platform: Platform;
  totals: MetricTotals;
  daily: DailyPoint[];
}

export interface Anomaly {
  date: string;
  metric: "roas" | "cost" | "conversions";
  value: number;
  mean: number;
  stddev: number;
  zScore: number;
  direction: "up" | "down";
}

export interface NorthStarScore {
  score: number; // 0-100
  grade: "excellent" | "healthy" | "attention" | "critical";
  breakdown: {
    roas: number;      // 0-40
    trend: number;     // 0-25
    efficiency: number;// 0-20
    stability: number; // 0-15
  };
}

export interface ResumenAnalytics {
  loading: boolean;
  hasData: boolean;
  range: number;
  totals: MetricTotals;
  previousTotals: MetricTotals;
  deltas: {
    cost: number;
    revenue: number;
    conversions: number;
    roas: number;
    ctr: number;
    cpa: number;
  };
  daily: DailyPoint[];
  platforms: PlatformSeries[];
  anomalies: Anomaly[];
  northStar: NorthStarScore;
  projection: {
    daysElapsedInMonth: number;
    daysInMonth: number;
    monthToDateCost: number;
    monthToDateRevenue: number;
    projectedCost: number;
    projectedRevenue: number;
    projectedRoas: number;
  };
}

// ---------- Helpers ----------

function toDailySeries(metrics: CampaignMetric[], rangeDays: number): DailyPoint[] {
  const byDay = new Map<string, DailyPoint>();
  // Seed all days in range with zeros (for continuous charts).
  const today = new Date();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, cost: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0, roas: 0 });
  }
  metrics.forEach((m) => {
    const key = m.date;
    const cur = byDay.get(key) || { date: key, cost: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0, roas: 0 };
    cur.cost += Number(m.cost) || 0;
    cur.clicks += Number(m.clicks) || 0;
    cur.impressions += Number(m.impressions) || 0;
    cur.conversions += Number(m.conversions) || 0;
    cur.revenue += Number(m.conversion_value) || 0;
    byDay.set(key, cur);
  });
  const arr = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  arr.forEach((d) => (d.roas = d.cost > 0 ? d.revenue / d.cost : 0));
  return arr;
}

function splitByPeriod(metrics: CampaignMetric[], days: number) {
  const today = new Date();
  const startCurrent = new Date(today); startCurrent.setDate(today.getDate() - days + 1);
  const startPrevious = new Date(today); startPrevious.setDate(today.getDate() - 2 * days + 1);
  const endPrevious = new Date(today); endPrevious.setDate(today.getDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const cS = iso(startCurrent), cE = iso(today);
  const pS = iso(startPrevious), pE = iso(endPrevious);
  const current: CampaignMetric[] = [];
  const previous: CampaignMetric[] = [];
  metrics.forEach((m) => {
    if (m.date >= cS && m.date <= cE) current.push(m);
    else if (m.date >= pS && m.date <= pE) previous.push(m);
  });
  return { current, previous };
}

function detectAnomalies(daily: DailyPoint[]): Anomaly[] {
  const out: Anomaly[] = [];
  if (daily.length < 7) return out;
  const metrics: Array<{ key: Anomaly["metric"]; get: (d: DailyPoint) => number }> = [
    { key: "roas", get: (d) => d.roas },
    { key: "cost", get: (d) => d.cost },
    { key: "conversions", get: (d) => d.conversions },
  ];
  metrics.forEach(({ key, get }) => {
    const values = daily.map(get).filter((v) => v > 0);
    if (values.length < 5) return;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);
    if (stddev === 0) return;
    daily.forEach((d) => {
      const v = get(d);
      if (v <= 0) return;
      const z = (v - mean) / stddev;
      if (Math.abs(z) >= 2) {
        out.push({
          date: d.date,
          metric: key,
          value: v,
          mean,
          stddev,
          zScore: z,
          direction: z > 0 ? "up" : "down",
        });
      }
    });
  });
  return out.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

function computeNorthStar(
  totals: MetricTotals,
  previousTotals: MetricTotals,
  daily: DailyPoint[],
): NorthStarScore {
  // ROAS component (0-40): 0x=0, 1x=10, 3x=30, 5x+=40
  const roasScore = Math.max(0, Math.min(40, (totals.roas / 5) * 40));

  // Trend component (0-25): revenue delta vs previous period
  const revDelta = pctChange(totals.conversion_value, previousTotals.conversion_value);
  const trendScore = Math.max(0, Math.min(25, 12.5 + (revDelta / 100) * 12.5));

  // Efficiency component (0-20): CTR + inverse CPA relative to baseline
  const ctrScore = Math.max(0, Math.min(10, (totals.ctr / 3) * 10)); // 3% CTR = full
  const conversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
  const convRateScore = Math.max(0, Math.min(10, (conversionRate / 5) * 10)); // 5% conv = full
  const efficiencyScore = ctrScore + convRateScore;

  // Stability component (0-15): inverse coefficient of variation on daily ROAS
  const roasValues = daily.map((d) => d.roas).filter((v) => v > 0);
  let stabilityScore = 0;
  if (roasValues.length >= 5) {
    const mean = roasValues.reduce((a, b) => a + b, 0) / roasValues.length;
    const variance = roasValues.reduce((a, b) => a + (b - mean) ** 2, 0) / roasValues.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    stabilityScore = Math.max(0, Math.min(15, (1 - Math.min(cv, 1)) * 15));
  }

  const score = Math.round(roasScore + trendScore + efficiencyScore + stabilityScore);
  const grade: NorthStarScore["grade"] =
    score >= 80 ? "excellent" : score >= 60 ? "healthy" : score >= 40 ? "attention" : "critical";

  return {
    score,
    grade,
    breakdown: {
      roas: Math.round(roasScore),
      trend: Math.round(trendScore),
      efficiency: Math.round(efficiencyScore),
      stability: Math.round(stabilityScore),
    },
  };
}

function computeProjection(daily: DailyPoint[]) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsedInMonth = today.getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const mtd = daily.filter((d) => d.date.startsWith(monthPrefix));
  const monthToDateCost = mtd.reduce((a, d) => a + d.cost, 0);
  const monthToDateRevenue = mtd.reduce((a, d) => a + d.revenue, 0);
  const dailyAvgCost = daysElapsedInMonth > 0 ? monthToDateCost / daysElapsedInMonth : 0;
  const dailyAvgRevenue = daysElapsedInMonth > 0 ? monthToDateRevenue / daysElapsedInMonth : 0;
  const projectedCost = dailyAvgCost * daysInMonth;
  const projectedRevenue = dailyAvgRevenue * daysInMonth;
  const projectedRoas = projectedCost > 0 ? projectedRevenue / projectedCost : 0;
  return {
    daysElapsedInMonth,
    daysInMonth,
    monthToDateCost,
    monthToDateRevenue,
    projectedCost,
    projectedRevenue,
    projectedRoas,
  };
}

// ---------- Hook ----------

/**
 * Analítica agregada para el tab Resumen del Campaign Monitor.
 * Consume metrics + campaigns y calcula en cliente: North Star Score, series
 * diarias, deltas vs período previo, anomalías (2σ) y proyección a fin de mes.
 */
export function useResumenAnalytics(range: number): ResumenAnalytics {
  // Traemos el doble del rango para poder comparar contra el período anterior.
  const { data: metrics, isLoading: metricsLoading } = useCampaignMetrics(undefined, range * 2);
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();

  return useMemo<ResumenAnalytics>(() => {
    const loading = metricsLoading || campaignsLoading;
    const allMetrics = metrics || [];
    const allCampaigns: CampaignSync[] = campaigns || [];

    const { current, previous } = splitByPeriod(allMetrics, range);
    const totals = aggregate(current);
    const previousTotals = aggregate(previous);
    const daily = toDailySeries(current, range);
    const platforms: PlatformSeries[] = aggregateByPlatform(current, allCampaigns).map((p) => {
      const campaignIds = new Set(allCampaigns.filter((c) => c.platform === p.platform).map((c) => c.id));
      const platformMetrics = current.filter((m) => campaignIds.has(m.campaign_sync_id));
      return {
        platform: p.platform,
        totals: { ...p },
        daily: toDailySeries(platformMetrics, range),
      };
    });
    const anomalies = detectAnomalies(daily);
    const northStar = computeNorthStar(totals, previousTotals, daily);
    const projection = computeProjection(daily);

    const deltas = {
      cost: pctChange(totals.cost, previousTotals.cost),
      revenue: pctChange(totals.conversion_value, previousTotals.conversion_value),
      conversions: pctChange(totals.conversions, previousTotals.conversions),
      roas: pctChange(totals.roas, previousTotals.roas),
      ctr: pctChange(totals.ctr, previousTotals.ctr),
      cpa: pctChange(totals.cpa, previousTotals.cpa),
    };

    return {
      loading,
      hasData: current.length > 0,
      range,
      totals,
      previousTotals,
      deltas,
      daily,
      platforms,
      anomalies,
      northStar,
      projection,
    };
  }, [metrics, campaigns, metricsLoading, campaignsLoading, range]);
}