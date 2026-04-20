import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import type { CampaignMetric } from "@/hooks/useCampaignMonitor";

interface Props {
  metrics: CampaignMetric[];
}

export function EfficiencyChart({ metrics }: Props) {
  // Agrupa por fecha sumando cost/clicks/conv y recalcula CPC y CPA por dia
  const byDate = new Map<string, { date: string; cost: number; clicks: number; conv: number }>();
  metrics.forEach((m) => {
    const cur = byDate.get(m.date) || { date: m.date, cost: 0, clicks: 0, conv: 0 };
    cur.cost += Number(m.cost);
    cur.clicks += Number(m.clicks);
    cur.conv += Number(m.conversions);
    byDate.set(m.date, cur);
  });
  const data = Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      cpc: d.clicks > 0 ? Math.round(d.cost / d.clicks) : 0,
      cpa: d.conv > 0 ? Math.round(d.cost / d.conv) : 0,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Eficiencia: CPC vs CPA</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 240 }}>
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="cpc" stroke="hsl(217 91% 60%)" name="CPC ($)" dot={false} strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="cpa" stroke="hsl(0 75% 55%)" name="CPA ($)" dot={false} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}