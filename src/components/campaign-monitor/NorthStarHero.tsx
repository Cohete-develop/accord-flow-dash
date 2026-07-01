import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { MetricHelp } from "./MetricHelp";
import type { NorthStarScore, DailyPoint } from "@/hooks/useResumenAnalytics";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

interface Props {
  score: NorthStarScore;
  daily: DailyPoint[];
  revenueDelta: number;
  range: number;
}

const GRADE_STYLES: Record<NorthStarScore["grade"], { label: string; ring: string; text: string; bg: string }> = {
  excellent: { label: "Excelente", ring: "ring-green-500/40", text: "text-green-500", bg: "from-green-500/20 to-emerald-500/5" },
  healthy:   { label: "Saludable", ring: "ring-primary/40",   text: "text-primary",   bg: "from-primary/20 to-primary/5" },
  attention: { label: "Atención",  ring: "ring-amber-500/40", text: "text-amber-500", bg: "from-amber-500/20 to-amber-500/5" },
  critical:  { label: "Crítico",   ring: "ring-destructive/40", text: "text-destructive", bg: "from-destructive/20 to-destructive/5" },
};

export function NorthStarHero({ score, daily, revenueDelta, range }: Props) {
  const style = GRADE_STYLES[score.grade];
  const sparkData = daily.map((d) => ({ v: d.roas }));
  const positive = revenueDelta >= 0;
  const animatedScore = useCountUp(score.score, 1100);
  const animatedDelta = useCountUp(revenueDelta, 900);

  return (
    <Card className={cn("relative overflow-hidden border-0 ring-1", style.ring)}>
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", style.bg)} />
      <CardContent className="relative pt-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-6 items-center">
          {/* Score dial */}
          <div className="flex flex-col items-center lg:items-start gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className={cn("h-4 w-4", style.text)} />
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">North Star Score</span>
              <MetricHelp
                title="North Star Score"
                what="Salud general de tus campañas en una sola métrica (0-100). Combina rentabilidad, tendencia, eficiencia y estabilidad."
                formula="ROAS (40%) + Tendencia (25%) + Eficiencia (20%) + Estabilidad (15%)"
                interpretation={[
                  { range: "80-100", meaning: "Excelente. Escalá presupuesto en las campañas ganadoras." },
                  { range: "60-79",  meaning: "Saludable. Mantené y optimizá al margen." },
                  { range: "40-59",  meaning: "Atención. Revisá campañas perdedoras y creativos." },
                  { range: "0-39",   meaning: "Crítico. Pausá lo que pierde y rediseñá segmentación." },
                ]}
                action="Usá el desglose de la derecha para saber qué componente arrastra tu score."
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-6xl font-bold tabular-nums", style.text)}>
                {Math.round(animatedScore)}
              </span>
              <span className="text-2xl text-muted-foreground font-light">/100</span>
            </div>
            <Badge variant="secondary" className={cn("gap-1", style.text)}>{style.label}</Badge>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
              Desglose
              <MetricHelp
                title="Desglose del score"
                what="Muestra cuánto aporta cada componente al puntaje total. Identificá el más bajo para saber qué mejorar primero."
                interpretation={[
                  { range: "ROAS",       meaning: "Rentabilidad directa: ingreso ÷ gasto." },
                  { range: "Tendencia",  meaning: "Ingresos actuales vs período anterior." },
                  { range: "Eficiencia", meaning: "CTR + tasa de conversión sobre clicks." },
                  { range: "Estabilidad",meaning: "Qué tan consistente es tu ROAS día a día." },
                ]}
              />
            </div>
            <BreakdownBar label="ROAS"        value={score.breakdown.roas}        max={40} />
            <BreakdownBar label="Tendencia"   value={score.breakdown.trend}       max={25} />
            <BreakdownBar label="Eficiencia"  value={score.breakdown.efficiency}  max={20} />
            <BreakdownBar label="Estabilidad" value={score.breakdown.stability}   max={15} />
          </div>

          {/* Sparkline + delta */}
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
              ROAS últimos {range} días
              <MetricHelp
                title="Tendencia de ROAS"
                what="Cómo evolucionó tu retorno por dólar invertido, día a día."
                interpretation="Buscá pendiente ascendente. Caídas bruscas suelen coincidir con cambios de creativo, presupuesto o competencia."
              />
            </div>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={positive ? "hsl(142 70% 45%)" : "hsl(0 75% 55%)"}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={900}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              {positive ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span className={cn("font-semibold tabular-nums", positive ? "text-green-500" : "text-destructive")}>
                {animatedDelta >= 0 ? "+" : ""}{animatedDelta.toFixed(1)}%
              </span>
              <span className="text-muted-foreground text-xs">ingresos vs período anterior</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{value}/{max}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

export default NorthStarHero;