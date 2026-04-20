import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Rocket, TrendingUp, DollarSign, Lightbulb, CheckCircle2 } from "lucide-react";
import type { CampaignMetric, CampaignSync, CampaignKeyword } from "@/hooks/useCampaignMonitor";
import { aggregateByCampaign, aggregateByPlatform, fmtMoney, PLATFORM_LABELS } from "./utils";

interface Props {
  metrics: CampaignMetric[];
  campaigns: CampaignSync[];
  keywords?: CampaignKeyword[];
}

type Tone = "warn" | "good" | "info" | "bad";
interface Insight {
  icon: typeof AlertTriangle;
  tone: Tone;
  title: string;
  body: string;
}

const toneStyles: Record<Tone, { border: string; iconCls: string }> = {
  warn: { border: "border-l-amber-500", iconCls: "text-amber-500" },
  good: { border: "border-l-green-600", iconCls: "text-green-600" },
  info: { border: "border-l-primary", iconCls: "text-primary" },
  bad: { border: "border-l-destructive", iconCls: "text-destructive" },
};

export function AutoInsights({ metrics, campaigns, keywords = [] }: Props) {
  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    const agg = aggregateByCampaign(metrics, campaigns).filter((c) => c.cost > 0);

    // 1) CTR bajo
    agg.forEach((c) => {
      if (c.ctr > 0 && c.ctr < 1) {
        out.push({
          icon: AlertTriangle, tone: "warn",
          title: `${c.campaign_name} tiene CTR bajo`,
          body: `CTR de ${c.ctr.toFixed(2)}%. Considera cambiar el creativo o ajustar la segmentación.`,
        });
      }
    });

    // 2) ROAS excelente
    agg.forEach((c) => {
      if (c.roas > 4) {
        out.push({
          icon: Rocket, tone: "good",
          title: `${c.campaign_name} tiene ROAS excelente`,
          body: `ROAS de ${c.roas.toFixed(2)}x. Considera aumentar su presupuesto para escalar.`,
        });
      }
    });

    // 3) ROAS perdedor
    agg.forEach((c) => {
      if (c.cost > 100000 && c.roas > 0 && c.roas < 1) {
        out.push({
          icon: AlertTriangle, tone: "bad",
          title: `${c.campaign_name} pierde dinero`,
          body: `ROAS ${c.roas.toFixed(2)}x con ${fmtMoney(c.cost)} gastados. Pausar o revisar urgentemente.`,
        });
      }
    });

    // 4) CPC subió en keyword (si hay datos de 2 semanas)
    if (keywords.length > 0) {
      const now = new Date();
      const w1 = new Date(now); w1.setDate(now.getDate() - 7);
      const w2 = new Date(now); w2.setDate(now.getDate() - 14);
      const recent = new Map<string, { sum: number; n: number }>();
      const previous = new Map<string, { sum: number; n: number }>();
      keywords.forEach((k) => {
        const d = new Date(k.date);
        const cpc = Number(k.cpc);
        if (cpc <= 0) return;
        const target = d >= w1 ? recent : d >= w2 ? previous : null;
        if (!target) return;
        const cur = target.get(k.keyword) || { sum: 0, n: 0 };
        cur.sum += cpc; cur.n += 1;
        target.set(k.keyword, cur);
      });
      recent.forEach((cur, kw) => {
        const prev = previous.get(kw);
        if (!prev) return;
        const a = cur.sum / cur.n, b = prev.sum / prev.n;
        if (b > 0 && (a - b) / b > 0.2) {
          out.push({
            icon: TrendingUp, tone: "warn",
            title: `CPC de "${kw}" subió ${(((a - b) / b) * 100).toFixed(0)}%`,
            body: `Pasó de ${fmtMoney(b)} a ${fmtMoney(a)}. Revisa la competencia en esa keyword.`,
          });
        }
      });
    }

    // 5) Comparativa entre plataformas
    const byPlat = aggregateByPlatform(metrics, campaigns).filter((p) => p.roas > 0);
    if (byPlat.length >= 2) {
      const sorted = [...byPlat].sort((a, b) => b.roas - a.roas);
      const best = sorted[0], worst = sorted[sorted.length - 1];
      if (best.roas / Math.max(worst.roas, 0.01) > 1.5) {
        out.push({
          icon: Lightbulb, tone: "info",
          title: `${PLATFORM_LABELS[best.platform]} rinde mejor que ${PLATFORM_LABELS[worst.platform]}`,
          body: `ROAS de ${best.roas.toFixed(2)}x vs ${worst.roas.toFixed(2)}x. Considera redistribuir presupuesto.`,
        });
      }
    }

    // 6) Pacing de presupuesto total
    const totalBudgetDaily = campaigns.filter((c) => c.status === "active").reduce((s, c) => s + Number(c.daily_budget || 0), 0);
    if (totalBudgetDaily > 0) {
      const totalSpent = agg.reduce((s, c) => s + c.cost, 0);
      const days = Math.max(1, new Set(metrics.map((m) => m.date)).size);
      const expected = totalBudgetDaily * days;
      if (expected > 0 && totalSpent / expected > 0.8) {
        out.push({
          icon: DollarSign, tone: "warn",
          title: "Consumo de presupuesto elevado",
          body: `Has consumido el ${((totalSpent / expected) * 100).toFixed(0)}% del presupuesto esperado en este período.`,
        });
      }
    }

    return out;
  }, [metrics, campaigns, keywords]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" /> Insights automáticos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Recomendaciones calculadas en tiempo real sobre tus datos.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Sin alertas notables. Tus campañas están en rango saludable.
          </div>
        )}
        {insights.map((ins, i) => {
          const s = toneStyles[ins.tone];
          const Icon = ins.icon;
          return (
            <div key={i} className={`border-l-4 ${s.border} bg-muted/20 rounded-md p-3`}>
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${s.iconCls}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{ins.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ins.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}