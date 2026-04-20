import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import type { CampaignMetric, CampaignSync } from "@/hooks/useCampaignMonitor";
import { aggregateByCampaign, fmtMoney } from "./utils";

interface Props {
  metrics: CampaignMetric[];
  campaigns: CampaignSync[];
}

export function CpaEfficiencyChart({ metrics, campaigns }: Props) {
  const { data, avg } = useMemo(() => {
    const list = aggregateByCampaign(metrics, campaigns)
      .filter((c) => c.cpa > 0)
      .map((c) => ({
        name: c.campaign_name.length > 22 ? c.campaign_name.slice(0, 22) + "…" : c.campaign_name,
        full: c.campaign_name,
        cpa: Math.round(c.cpa),
      }))
      .sort((a, b) => a.cpa - b.cpa);
    const sum = list.reduce((s, d) => s + d.cpa, 0);
    return { data: list, avg: list.length > 0 ? Math.round(sum / list.length) : 0 };
  }, [metrics, campaigns]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Eficiencia del gasto — CPA por campaña</CardTitle>
        <p className="text-xs text-muted-foreground">
          Línea punteada = CPA promedio ({fmtMoney(avg)}). Verde: bajo el promedio. Rojo: sobre el promedio.
        </p>
      </CardHeader>
      <CardContent style={{ height: 320 }}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sin datos</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any) => fmtMoney(v as number)}
                labelFormatter={(l: any, p: any) => p?.[0]?.payload?.full || l}
              />
              <ReferenceLine y={avg} stroke="hsl(var(--foreground))" strokeDasharray="4 4" label={{ value: `Promedio: ${fmtMoney(avg)}`, fontSize: 10 }} />
              <Bar dataKey="cpa" name="CPA">
                {data.map((d, i) => (
                  <Cell key={i} fill={d.cpa <= avg ? "hsl(142 70% 45%)" : "hsl(0 75% 55%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}