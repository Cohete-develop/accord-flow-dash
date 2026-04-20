import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { CampaignMetric, CampaignSync } from "@/hooks/useCampaignMonitor";
import { aggregateByPlatform, fmtMoney, PLATFORM_COLORS, PLATFORM_LABELS } from "./utils";

interface Props {
  metrics: CampaignMetric[];
  campaigns: CampaignSync[];
}

export function SpendByPlatformCard({ metrics, campaigns }: Props) {
  const data = useMemo(() => {
    const byPlatform = aggregateByPlatform(metrics, campaigns);
    const total = byPlatform.reduce((s, p) => s + p.cost, 0);
    return byPlatform
      .filter((p) => p.cost > 0)
      .map((p) => ({
        name: PLATFORM_LABELS[p.platform],
        value: Math.round(p.cost),
        platform: p.platform,
        pct: total > 0 ? (p.cost / total) * 100 : 0,
      }));
  }, [metrics, campaigns]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribución de gasto por plataforma</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 280 }}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Sin datos en el rango
          </div>
        ) : (
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                label={(e: any) => `${e.pct.toFixed(0)}%`}
              >
                {data.map((d) => (
                  <Cell key={d.platform} fill={PLATFORM_COLORS[d.platform as keyof typeof PLATFORM_COLORS]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, n: any, p: any) => [`${fmtMoney(v)} (${p.payload.pct.toFixed(1)}%)`, n]} />
              <Legend
                formatter={(value: any, entry: any) =>
                  `${value} — ${fmtMoney(entry.payload.value)} (${entry.payload.pct.toFixed(0)}%)`
                }
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}