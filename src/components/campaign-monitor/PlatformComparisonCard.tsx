import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CampaignMetric, CampaignSync } from "@/hooks/useCampaignMonitor";
import { aggregateByPlatform, fmtMoney, fmtNum, fmtPct, PLATFORM_LABELS } from "./utils";

interface Props {
  metrics: CampaignMetric[];
  campaigns: CampaignSync[];
}

type MetricKey = "cost" | "clicks" | "conversions" | "ctr" | "cpc" | "cpa" | "roas";
// true = mayor es mejor; false = menor es mejor
const HIGHER_IS_BETTER: Record<MetricKey, boolean> = {
  cost: false, // gastar menos para mismas conv = mejor (ambiguo, lo dejamos neutro: lower better)
  clicks: true,
  conversions: true,
  ctr: true,
  cpc: false,
  cpa: false,
  roas: true,
};

export function PlatformComparisonCard({ metrics, campaigns }: Props) {
  const rows = useMemo(() => aggregateByPlatform(metrics, campaigns), [metrics, campaigns]);

  const bestWorst = useMemo(() => {
    const map: Partial<Record<MetricKey, { best: number; worst: number }>> = {};
    (Object.keys(HIGHER_IS_BETTER) as MetricKey[]).forEach((k) => {
      const vals = rows.map((r) => r[k]).filter((v) => v > 0);
      if (vals.length < 2) return;
      const max = Math.max(...vals), min = Math.min(...vals);
      map[k] = HIGHER_IS_BETTER[k] ? { best: max, worst: min } : { best: min, worst: max };
    });
    return map;
  }, [rows]);

  const cellClass = (k: MetricKey, v: number) => {
    const bw = bestWorst[k];
    if (!bw || v === 0) return "";
    if (v === bw.best) return "text-green-600 dark:text-green-400 font-semibold";
    if (v === bw.worst) return "text-destructive font-semibold";
    return "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rendimiento por plataforma</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plataforma</TableHead>
              <TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Conv.</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">CPC</TableHead>
              <TableHead className="text-right">CPA</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.platform}>
                <TableCell className="font-medium">{PLATFORM_LABELS[r.platform]}</TableCell>
                <TableCell className={`text-right ${cellClass("cost", r.cost)}`}>{fmtMoney(r.cost)}</TableCell>
                <TableCell className={`text-right ${cellClass("clicks", r.clicks)}`}>{fmtNum(r.clicks)}</TableCell>
                <TableCell className={`text-right ${cellClass("conversions", r.conversions)}`}>{fmtNum(r.conversions)}</TableCell>
                <TableCell className={`text-right ${cellClass("ctr", r.ctr)}`}>{fmtPct(r.ctr)}</TableCell>
                <TableCell className={`text-right ${cellClass("cpc", r.cpc)}`}>{fmtMoney(r.cpc)}</TableCell>
                <TableCell className={`text-right ${cellClass("cpa", r.cpa)}`}>{r.cpa > 0 ? fmtMoney(r.cpa) : "—"}</TableCell>
                <TableCell className={`text-right ${cellClass("roas", r.roas)}`}>{r.roas.toFixed(2)}x</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sin datos</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}