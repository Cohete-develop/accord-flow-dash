import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { CampaignMetric } from "@/hooks/useCampaignMonitor";
import { aggregate, fmtMoney, fmtNum, fmtPct, pctChange, filterByDays } from "./utils";

interface Props {
  metrics: CampaignMetric[];
  days: number;
}

// Métricas donde "subir" es bueno
const HIGHER_IS_BETTER: Record<string, boolean> = {
  cost: false, // sube costo => malo (a igualdad)
  clicks: true,
  ctr: true,
  conversions: true,
  roas: true,
};

const LABELS: Record<string, string> = {
  cost: "Gasto",
  clicks: "Clicks",
  ctr: "CTR",
  conversions: "Conversiones",
  roas: "ROAS",
};

export function PeriodComparisonCard({ metrics, days }: Props) {
  const { current, previous } = useMemo(() => {
    const cur = aggregate(filterByDays(metrics, days, 0));
    const prev = aggregate(filterByDays(metrics, days, days));
    return { current: cur, previous: prev };
  }, [metrics, days]);

  const fmt = (k: string, v: number) => {
    if (k === "cost") return fmtMoney(v);
    if (k === "ctr") return fmtPct(v);
    if (k === "roas") return `${v.toFixed(2)}x`;
    return fmtNum(v);
  };

  const rows = (Object.keys(LABELS) as Array<keyof typeof LABELS>).map((k) => {
    const cur = (current as any)[k] as number;
    const prev = (previous as any)[k] as number;
    const change = pctChange(cur, prev);
    const better = HIGHER_IS_BETTER[k] ? change > 0 : change < 0;
    const same = Math.abs(change) < 0.5;
    return { k, label: LABELS[k], cur, prev, change, better, same };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Cambio vs período anterior
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Últimos {days} días vs {days} días anteriores
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {rows.map((r) => {
            const Icon = r.same ? Minus : r.better ? TrendingUp : TrendingDown;
            const tone = r.same
              ? "text-muted-foreground"
              : r.better
              ? "text-green-600 dark:text-green-400"
              : "text-destructive";
            return (
              <div key={r.k} className="border rounded-md p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{r.label}</p>
                <p className="text-lg font-bold mt-1">{fmt(r.k, r.cur)}</p>
                <p className="text-xs text-muted-foreground">antes: {fmt(r.k, r.prev)}</p>
                <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${tone}`}>
                  <Icon className="h-3 w-3" />
                  {r.same ? "sin cambio" : `${r.change > 0 ? "+" : ""}${r.change.toFixed(1)}%`}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}