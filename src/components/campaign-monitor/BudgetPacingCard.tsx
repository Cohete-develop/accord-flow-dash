import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { CampaignMetric, CampaignSync } from "@/hooks/useCampaignMonitor";
import { aggregateByCampaign, fmtMoney, PLATFORM_LABELS } from "./utils";

interface Props {
  metrics: CampaignMetric[];
  campaigns: CampaignSync[];
  /** Days currently selected on Resumen */
  daysSelected: number;
}

/**
 * Para cada campaña activa con daily_budget, calcula:
 *  - gasto del período seleccionado
 *  - gasto esperado = daily_budget * daysSelected
 *  - % consumo
 * Verde si pace 90-110%, amarillo 110-120%, rojo >120% o <70%.
 */
export function BudgetPacingCard({ metrics, campaigns, daysSelected }: Props) {
  const rows = useMemo(() => {
    return aggregateByCampaign(metrics, campaigns)
      .filter((c) => c.status === "active" && Number(c.daily_budget) > 0)
      .map((c) => {
        const expected = Number(c.daily_budget) * daysSelected;
        const pct = expected > 0 ? (c.cost / expected) * 100 : 0;
        let tone: "good" | "warn" | "bad" | "low" = "good";
        if (pct > 120) tone = "bad";
        else if (pct > 110) tone = "warn";
        else if (pct < 70) tone = "low";
        return { ...c, expected, pct, tone };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [metrics, campaigns, daysSelected]);

  const toneBadge = {
    good: { label: "En ritmo", cls: "bg-green-600 hover:bg-green-700" },
    warn: { label: "Sobre el pace", cls: "bg-amber-500 hover:bg-amber-600 text-white" },
    bad: { label: "Riesgo: agota presupuesto", cls: "bg-destructive hover:bg-destructive/90" },
    low: { label: "Bajo gasto", cls: "bg-muted text-muted-foreground hover:bg-muted/80" },
  };

  const barColor = (tone: string) =>
    tone === "bad" ? "hsl(0 75% 55%)"
    : tone === "warn" ? "hsl(38 90% 55%)"
    : tone === "low" ? "hsl(220 9% 60%)"
    : "hsl(142 70% 45%)";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ritmo de gasto (Budget Pacing)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Gasto del período vs presupuesto diario × {daysSelected} días esperados
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay campañas activas con presupuesto diario configurado.</p>
        )}
        {rows.map((c) => {
          const t = toneBadge[c.tone];
          return (
            <div key={c.id}>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{c.campaign_name}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{PLATFORM_LABELS[c.platform]}</Badge>
                </div>
                <Badge className={`shrink-0 ${t.cls}`}>{t.label}</Badge>
              </div>
              <div className="relative">
                <Progress
                  value={Math.min(c.pct, 130)}
                  className="h-2"
                  style={{ ["--progress-foreground" as any]: barColor(c.tone) }}
                />
                <div
                  className="absolute inset-0 h-2 rounded-full"
                  style={{
                    width: `${Math.min(c.pct, 130) / 130 * 100}%`,
                    background: barColor(c.tone),
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{fmtMoney(c.cost)} de {fmtMoney(c.expected)} esperado</span>
                <span className="font-medium">{c.pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}