import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, ReferenceLine,
  Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Flame, Snowflake } from "lucide-react";
import { MetricHelp } from "./MetricHelp";
import { fmtMoney } from "./utils";
import type { DailyPoint } from "@/hooks/useResumenAnalytics";

interface Props {
  daily: DailyPoint[];
}

interface Enriched extends DailyPoint {
  ma7: number | null;
  status: "win" | "loss" | "neutral" | "empty";
  fill: string;
}

export function MomentumChart({ daily }: Props) {
  const { series, stats } = useMemo(() => {
    const revenues = daily.map((d) => d.revenue).filter((v) => v > 0);
    const mean = revenues.length ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0;
    const variance = revenues.length
      ? revenues.reduce((a, b) => a + (b - mean) ** 2, 0) / revenues.length
      : 0;
    const stddev = Math.sqrt(variance);
    const upThreshold = mean + 0.5 * stddev;
    const downThreshold = Math.max(0, mean - 0.5 * stddev);

    const series: Enriched[] = daily.map((d, i) => {
      const window = daily.slice(Math.max(0, i - 6), i + 1);
      const ma7 = window.length ? window.reduce((a, b) => a + b.revenue, 0) / window.length : 0;
      let status: Enriched["status"] = "neutral";
      let fill = "hsl(var(--muted-foreground) / 0.35)";
      if (d.revenue === 0) {
        status = "empty";
        fill = "hsl(var(--muted) / 0.6)";
      } else if (d.revenue >= upThreshold && upThreshold > 0) {
        status = "win";
        fill = "hsl(142 70% 45%)";
      } else if (d.revenue <= downThreshold && d.revenue > 0) {
        status = "loss";
        fill = "hsl(0 75% 55%)";
      }
      return { ...d, ma7: i >= 6 ? ma7 : null, status, fill };
    });

    // Streak: last consecutive win/loss
    let currentStreak = 0;
    let streakType: "win" | "loss" | null = null;
    for (let i = series.length - 1; i >= 0; i--) {
      const s = series[i].status;
      if (s === "empty" || s === "neutral") break;
      if (streakType === null) streakType = s;
      if (s === streakType) currentStreak++;
      else break;
    }

    const wins = series.filter((s) => s.status === "win").length;
    const losses = series.filter((s) => s.status === "loss").length;

    return { series, stats: { mean, wins, losses, streakType, currentStreak, upThreshold, downThreshold } };
  }, [daily]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            Momentum de ingresos
            <MetricHelp
              title="Momentum diario"
              what="Ingresos día a día con clasificación automática: días verdes están por encima del promedio + 0.5σ, días rojos debajo del promedio − 0.5σ. La línea es la media móvil de 7 días."
              formula="win: revenue ≥ media + 0.5σ · loss: revenue ≤ media − 0.5σ"
              interpretation="Racha larga de wins = campaña con momentum, ideal para escalar. Racha de losses = investigá creativos, competencia o estacionalidad."
              action="Miralo junto al ROAS del día. Un pico de revenue sin ROAS proporcional suele significar que gastaste más."
            />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-green-500">
              <TrendingUp className="h-3 w-3" /> {stats.wins} días ganadores
            </Badge>
            <Badge variant="secondary" className="gap-1 text-destructive">
              <TrendingDown className="h-3 w-3" /> {stats.losses} días perdedores
            </Badge>
            {stats.streakType && stats.currentStreak >= 2 && (
              <Badge
                variant="outline"
                className={
                  stats.streakType === "win"
                    ? "gap-1 border-green-500/40 text-green-500"
                    : "gap-1 border-destructive/40 text-destructive"
                }
              >
                {stats.streakType === "win" ? <Flame className="h-3 w-3" /> : <Snowflake className="h-3 w-3" />}
                Racha {stats.streakType === "win" ? "ganadora" : "perdedora"}: {stats.currentStreak}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent style={{ height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickFormatter={(d) => (d as string).slice(5)}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
            <RTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as Enriched;
                const label =
                  d.status === "win" ? "Día ganador"
                  : d.status === "loss" ? "Día perdedor"
                  : d.status === "empty" ? "Sin datos"
                  : "Día neutro";
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                    <div className="font-medium mb-1">{d.date}</div>
                    <div className="text-muted-foreground">Ingresos: <span className="text-foreground font-medium">{fmtMoney(d.revenue)}</span></div>
                    <div className="text-muted-foreground">Gasto: <span className="text-foreground font-medium">{fmtMoney(d.cost)}</span></div>
                    <div className="text-muted-foreground">ROAS: <span className="text-foreground font-medium">{d.roas.toFixed(2)}x</span></div>
                    <div className="mt-1 text-[11px]" style={{ color: d.fill }}>{label}</div>
                  </div>
                );
              }}
            />
            {stats.upThreshold > 0 && (
              <ReferenceLine
                y={stats.upThreshold}
                stroke="hsl(142 70% 45% / 0.5)"
                strokeDasharray="4 4"
                label={{ value: "win", position: "right", fill: "hsl(142 70% 45%)", fontSize: 10 }}
              />
            )}
            {stats.downThreshold > 0 && (
              <ReferenceLine
                y={stats.downThreshold}
                stroke="hsl(0 75% 55% / 0.5)"
                strokeDasharray="4 4"
                label={{ value: "loss", position: "right", fill: "hsl(0 75% 55%)", fontSize: 10 }}
              />
            )}
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
              {series.map((s, i) => (
                <Cell key={i} fill={s.fill} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="ma7"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default MomentumChart;