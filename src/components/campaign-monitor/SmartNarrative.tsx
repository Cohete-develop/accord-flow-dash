import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, TrendingUp, TrendingDown, AlertTriangle, Target,
  Rocket, Calendar, Zap, CheckCircle2,
} from "lucide-react";
import { MetricHelp } from "./MetricHelp";
import { cn } from "@/lib/utils";
import { fmtMoney, PLATFORM_LABELS } from "./utils";
import type { ResumenAnalytics, Anomaly } from "@/hooks/useResumenAnalytics";

interface Props {
  analytics: ResumenAnalytics;
}

type Tone = "good" | "warn" | "bad" | "info";
interface Story {
  id: string;
  tone: Tone;
  icon: typeof Sparkles;
  title: string;
  body: string;
  weight: number; // higher = more important, sorted first
}

const TONE_STYLES: Record<Tone, { border: string; icon: string; badge: string; bg: string }> = {
  good: { border: "border-l-green-500",     icon: "text-green-500",     badge: "bg-green-500/15 text-green-600 dark:text-green-400", bg: "bg-green-500/5" },
  warn: { border: "border-l-amber-500",     icon: "text-amber-500",     badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400", bg: "bg-amber-500/5" },
  bad:  { border: "border-l-destructive",   icon: "text-destructive",   badge: "bg-destructive/15 text-destructive",                 bg: "bg-destructive/5" },
  info: { border: "border-l-primary",       icon: "text-primary",       badge: "bg-primary/15 text-primary",                         bg: "bg-primary/5" },
};

function formatAnomaly(a: Anomaly): { title: string; body: string; tone: Tone } {
  const metricLabel = a.metric === "roas" ? "ROAS" : a.metric === "cost" ? "Gasto" : "Conversiones";
  const goodDirection = a.metric === "cost" ? (a.direction === "down") : (a.direction === "up");
  const tone: Tone = goodDirection ? "good" : "bad";
  const arrow = a.direction === "up" ? "↑" : "↓";
  const valueFmt =
    a.metric === "cost" ? fmtMoney(a.value)
    : a.metric === "roas" ? `${a.value.toFixed(2)}x`
    : Math.round(a.value).toLocaleString("en-US");
  const meanFmt =
    a.metric === "cost" ? fmtMoney(a.mean)
    : a.metric === "roas" ? `${a.mean.toFixed(2)}x`
    : Math.round(a.mean).toLocaleString("en-US");
  return {
    title: `${a.date}: ${metricLabel} ${arrow} anómalo (${valueFmt})`,
    body: `Se desvió ${Math.abs(a.zScore).toFixed(1)}σ del promedio del período (${meanFmt}). ${
      goodDirection
        ? "Identificá qué cambió ese día para replicarlo."
        : "Revisá qué pasó ese día: cambio de creativo, presupuesto, o factor externo."
    }`,
    tone,
  };
}

export function SmartNarrative({ analytics }: Props) {
  const stories = useMemo<Story[]>(() => {
    const out: Story[] = [];
    const { northStar, deltas, totals, previousTotals, platforms, projection, anomalies, range } = analytics;

    // 1) Executive one-liner sobre North Star
    const revDeltaAbs = Math.abs(deltas.revenue);
    const nsBody =
      northStar.grade === "excellent"
        ? `Tu score es ${northStar.score}/100. Estás en el top de rentabilidad — buen momento para escalar presupuesto en las campañas ganadoras.`
        : northStar.grade === "healthy"
        ? `Tu score es ${northStar.score}/100. Todo funciona, pero hay margen para optimizar el componente más bajo del desglose.`
        : northStar.grade === "attention"
        ? `Tu score es ${northStar.score}/100. Hay señales de deterioro. Revisá campañas perdedoras antes de que se agraven.`
        : `Tu score es ${northStar.score}/100. Situación crítica: pausá lo que pierde dinero y rediseñá segmentación.`;
    out.push({
      id: "ns",
      tone: northStar.grade === "excellent" || northStar.grade === "healthy" ? "good" : northStar.grade === "attention" ? "warn" : "bad",
      icon: Sparkles,
      title: "Diagnóstico general",
      body: nsBody,
      weight: 100,
    });

    // 2) Tendencia de ingresos
    if (previousTotals.conversion_value > 0 || totals.conversion_value > 0) {
      const positive = deltas.revenue >= 0;
      out.push({
        id: "revenue-trend",
        tone: positive ? (deltas.revenue > 20 ? "good" : "info") : (deltas.revenue < -20 ? "bad" : "warn"),
        icon: positive ? TrendingUp : TrendingDown,
        title: `Ingresos ${positive ? "crecieron" : "cayeron"} ${revDeltaAbs.toFixed(1)}% vs período anterior`,
        body: `Pasaste de ${fmtMoney(previousTotals.conversion_value)} a ${fmtMoney(totals.conversion_value)} en ${range} días. ${
          positive
            ? "Buscá qué cambió (creativos, audiencia, presupuesto) y consolidalo."
            : "Identificá qué campaña bajó su aporte y actuá antes de que el mes cierre en rojo."
        }`,
        weight: 90,
      });
    }

    // 3) ROAS vs período anterior
    if (Math.abs(deltas.roas) > 10 && (totals.roas > 0 || previousTotals.roas > 0)) {
      const up = deltas.roas > 0;
      out.push({
        id: "roas-shift",
        tone: up ? "good" : "warn",
        icon: up ? Rocket : AlertTriangle,
        title: `ROAS ${up ? "mejoró" : "empeoró"} ${Math.abs(deltas.roas).toFixed(1)}%`,
        body: `Pasó de ${previousTotals.roas.toFixed(2)}x a ${totals.roas.toFixed(2)}x. ${
          up ? "La eficiencia por dólar invertido subió." : "Estás sacando menos revenue por dólar. Auditá campañas de bajo rendimiento."
        }`,
        weight: 85,
      });
    }

    // 4) Plataforma dominante en ROAS
    const platWithRoas = platforms.filter((p) => p.totals.roas > 0 && p.totals.cost > 0);
    if (platWithRoas.length >= 2) {
      const sorted = [...platWithRoas].sort((a, b) => b.totals.roas - a.totals.roas);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const ratio = best.totals.roas / Math.max(worst.totals.roas, 0.01);
      if (ratio >= 1.5) {
        out.push({
          id: "plat-dominance",
          tone: "info",
          icon: Target,
          title: `${PLATFORM_LABELS[best.platform]} rinde ${ratio.toFixed(1)}× más que ${PLATFORM_LABELS[worst.platform]}`,
          body: `ROAS ${best.totals.roas.toFixed(2)}x vs ${worst.totals.roas.toFixed(2)}x. Considerá mover parte del presupuesto de ${PLATFORM_LABELS[worst.platform]} a ${PLATFORM_LABELS[best.platform]} y medí el impacto en 7-14 días.`,
          weight: 80,
        });
      }
    }

    // 5) Proyección de fin de mes
    if (projection.daysElapsedInMonth >= 3 && projection.projectedCost > 0) {
      const remaining = projection.daysInMonth - projection.daysElapsedInMonth;
      out.push({
        id: "projection",
        tone: projection.projectedRoas >= 2 ? "good" : projection.projectedRoas >= 1 ? "warn" : "bad",
        icon: Calendar,
        title: `Proyección de mes: ${fmtMoney(projection.projectedRevenue)} / ${fmtMoney(projection.projectedCost)}`,
        body: `Al ritmo actual (${projection.daysElapsedInMonth} de ${projection.daysInMonth} días) cerrarás con ROAS ${projection.projectedRoas.toFixed(2)}x. Te quedan ${remaining} días para ajustar.`,
        weight: 75,
      });
    }

    // 6) CTR anormalmente bajo o alto
    if (totals.impressions > 1000) {
      if (totals.ctr < 1) {
        out.push({
          id: "ctr-low",
          tone: "warn",
          icon: AlertTriangle,
          title: `CTR general bajo: ${totals.ctr.toFixed(2)}%`,
          body: "Menos del 1% de las impresiones generan clic. Es un síntoma de creativos débiles o audiencia mal segmentada.",
          weight: 65,
        });
      } else if (totals.ctr > 3) {
        out.push({
          id: "ctr-high",
          tone: "good",
          icon: Zap,
          title: `CTR general excelente: ${totals.ctr.toFixed(2)}%`,
          body: "Tus anuncios resuenan con la audiencia. Aprovechá para ampliar audiencias similares o incrementar frecuencia.",
          weight: 60,
        });
      }
    }

    // 7) Anomalías destacadas (top 3 por |z|)
    anomalies.slice(0, 3).forEach((a, i) => {
      const f = formatAnomaly(a);
      out.push({
        id: `anomaly-${i}`,
        tone: f.tone,
        icon: f.tone === "good" ? Rocket : AlertTriangle,
        title: f.title,
        body: f.body,
        weight: 50 - i, // preserve order, below strategic insights
      });
    });

    return out.sort((a, b) => b.weight - a.weight);
  }, [analytics]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Narrativa inteligente
              <MetricHelp
                title="Narrativa inteligente"
                what="Traduce tus números en una historia priorizada: qué está pasando, por qué, y qué hacer al respecto."
                interpretation="Los insights aparecen ordenados por importancia. Los primeros son estratégicos; los últimos, anomalías puntuales del período."
                action="Leelo de arriba hacia abajo. Cada tarjeta describe un patrón + acción concreta."
              />
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {stories.length} observaciones · {analytics.anomalies.length} anomalías detectadas
            </p>
          </div>
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" /> Auto-generado
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {stories.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Todo en rango normal. Sin insights destacados para este período.
          </div>
        )}
        {stories.map((s) => {
          const t = TONE_STYLES[s.tone];
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className={cn("border-l-4 rounded-md p-3 transition-colors", t.border, t.bg)}
            >
              <div className="flex items-start gap-3">
                <div className={cn("shrink-0 h-8 w-8 rounded-full flex items-center justify-center", t.badge)}>
                  <Icon className={cn("h-4 w-4", t.icon)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default SmartNarrative;