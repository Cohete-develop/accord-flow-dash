import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { CampaignMetric, CampaignSync } from "@/hooks/useCampaignMonitor";
import { aggregateByCampaign, fmtMoney } from "./utils";

interface Props {
  metrics: CampaignMetric[];
  campaigns: CampaignSync[];
}

export function TopBottomCampaignsCard({ metrics, campaigns }: Props) {
  const { top, bottom } = useMemo(() => {
    const agg = aggregateByCampaign(metrics, campaigns).filter((c) => c.cost > 0);
    const top = [...agg].filter((c) => c.roas > 0).sort((a, b) => b.roas - a.roas).slice(0, 3);
    const bottom = [...agg].filter((c) => c.cpa > 0).sort((a, b) => b.cpa - a.cpa).slice(0, 3);
    return { top, bottom };
  }, [metrics, campaigns]);

  const recommend = (cpa: number) => {
    if (cpa > 100000) return "Considera pausar";
    if (cpa > 50000) return "Revisar segmentación";
    return "Optimizar creativos";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" /> Top 3 campañas por ROAS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {top.length === 0 && <p className="text-sm text-muted-foreground">Sin datos</p>}
          {top.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between border rounded-md p-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="shrink-0">#{i + 1}</Badge>
                <span className="text-sm font-medium truncate">{c.campaign_name}</span>
              </div>
              <Badge className="bg-green-600 hover:bg-green-700 shrink-0">{c.roas.toFixed(2)}x</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" /> 3 campañas con peor CPA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bottom.length === 0 && <p className="text-sm text-muted-foreground">Sin datos</p>}
          {bottom.map((c, i) => (
            <div key={c.id} className="border rounded-md p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="shrink-0">#{i + 1}</Badge>
                  <span className="text-sm font-medium truncate">{c.campaign_name}</span>
                </div>
                <Badge variant="destructive" className="shrink-0">{fmtMoney(c.cpa)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-1">⚠ {recommend(c.cpa)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}