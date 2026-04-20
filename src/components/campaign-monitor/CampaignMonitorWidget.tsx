import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { useCampaigns, useCampaignMetrics, useAlertHistory } from "@/hooks/useCampaignMonitor";

const fmtMoney = (n: number) => `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function CampaignMonitorWidget() {
  const { data: campaigns = [] } = useCampaigns();
  const { data: metrics = [] } = useCampaignMetrics(undefined, 1);
  const { data: history = [] } = useAlertHistory();
  const { data: metrics30 = [] } = useCampaignMetrics(undefined, 30);

  const todayCost = metrics.reduce((s, m) => s + Number(m.cost), 0);
  const totalBudget = campaigns.reduce((s, c) => s + Number(c.daily_budget || 0), 0);
  const unack = history.filter((h) => !h.acknowledged_at).length;

  const ranking = useMemo(() => {
    const map = new Map<string, { id: string; name: string; cost: number; conv_value: number }>();
    metrics30.forEach((m) => {
      const c = campaigns.find((x) => x.id === m.campaign_sync_id);
      if (!c) return;
      const cur = map.get(c.id) || { id: c.id, name: c.campaign_name, cost: 0, conv_value: 0 };
      cur.cost += Number(m.cost);
      cur.conv_value += Number(m.conversion_value);
      map.set(c.id, cur);
    });
    const list = Array.from(map.values()).map((c) => ({ ...c, roas: c.cost > 0 ? c.conv_value / c.cost : 0 }));
    return {
      top: [...list].sort((a, b) => b.roas - a.roas).slice(0, 3),
      bottom: [...list].sort((a, b) => a.roas - b.roas).slice(0, 3),
    };
  }, [metrics30, campaigns]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Campaign Monitor
          <Badge variant="outline" className="ml-2 text-xs">PREMIUM</Badge>
        </CardTitle>
        <Button asChild size="sm" variant="ghost">
          <Link to="/campaign-monitor">Ver todo <ArrowRight className="h-4 w-4 ml-1" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-md p-3">
            <p className="text-xs text-muted-foreground">Gasto hoy</p>
            <p className="text-xl font-bold">{fmtMoney(todayCost)}</p>
            <p className="text-xs text-muted-foreground">de {fmtMoney(totalBudget)} presup. diario</p>
          </div>
          <div className="border rounded-md p-3">
            <p className="text-xs text-muted-foreground">Alertas sin reconocer</p>
            <p className="text-xl font-bold flex items-center gap-2">
              {unack}
              {unack > 0 && <AlertTriangle className="h-4 w-4 text-orange-500" />}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" /> Top ROAS
            </p>
            {ranking.top.map((c) => (
              <div key={c.id} className="flex justify-between text-xs py-0.5">
                <span className="truncate">{c.name}</span>
                <span className="font-medium">{c.roas.toFixed(2)}x</span>
              </div>
            ))}
            {ranking.top.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" /> Bottom ROAS
            </p>
            {ranking.bottom.map((c) => (
              <div key={c.id} className="flex justify-between text-xs py-0.5">
                <span className="truncate">{c.name}</span>
                <span className="font-medium">{c.roas.toFixed(2)}x</span>
              </div>
            ))}
            {ranking.bottom.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
