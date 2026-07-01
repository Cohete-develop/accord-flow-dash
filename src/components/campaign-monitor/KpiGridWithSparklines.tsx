import { Card, CardContent } from "@/components/ui/card";
import { Line, LineChart, ResponsiveContainer, Area, AreaChart } from "recharts";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { MetricHelp, type MetricHelpProps } from "./MetricHelp";
import type { DailyPoint, ResumenAnalytics } from "@/hooks/useResumenAnalytics";
import { fmtMoney, fmtNum, fmtPct } from "./utils";
import { cn } from "@/lib/utils";

interface KpiConfig {
  key: keyof DailyPoint;
  label: string;
  value: string;
  delta: number;
  // higher-is-better vs lower-is-better (e.g. CPA lower is better)
  betterWhen: "higher" | "lower";
  help: Omit<MetricHelpProps, "className" | "iconClassName" | "side">;
}

interface Props {
  analytics: ResumenAnalytics;
}

export function KpiGridWithSparklines({ analytics }: Props) {
  const { totals, deltas, daily } = analytics;
  const conversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
  const prevConvRate = analytics.previousTotals.clicks > 0
    ? (analytics.previousTotals.conversions / analytics.previousTotals.clicks) * 100
    : 0;
  const convRateDelta = prevConvRate > 0 ? ((conversionRate - prevConvRate) / prevConvRate) * 100 : 0;

  const kpis: KpiConfig[] = [
    {
      key: "cost",
      label: "Gasto",
      value: fmtMoney(totals.cost),
      delta: deltas.cost,
      betterWhen: "lower",
      help: {
        title: "Gasto total",
        what: "Cuánto invertiste en pauta durante el período seleccionado, sumando todas las plataformas conectadas.",
        formula: "Σ cost de campaign_metrics en el rango",
        interpretation: "Solo tiene sentido leerlo junto a ROAS. Gastar más no es malo si el retorno acompaña.",
        action: "Si sube pero ROAS baja, revisá pacing y campañas nuevas que no estén rindiendo.",
      },
    },
    {
      key: "revenue",
      label: "Ingresos",
      value: fmtMoney(totals.conversion_value),
      delta: deltas.revenue,
      betterWhen: "higher",
      help: {
        title: "Ingresos atribuidos",
        what: "Valor total de conversiones reportado por las plataformas para las campañas activas.",
        formula: "Σ conversion_value de campaign_metrics",
        interpretation: "El crecimiento vs período anterior es la señal más importante. Un +20% sostenido es excelente.",
        action: "Si cae mientras gasto se mantiene, revisá anomalías y creativos pausados.",
      },
    },
    {
      key: "conversions",
      label: "Conversiones",
      value: fmtNum(totals.conversions),
      delta: deltas.conversions,
      betterWhen: "higher",
      help: {
        title: "Conversiones",
        what: "Acciones valiosas completadas: compras, leads o registros según cómo estén configurados los eventos.",
        interpretation: [
          { range: "0",     meaning: "Revisá el tracking de eventos. No hay señal de conversión." },
          { range: "1-10",  meaning: "Volumen bajo. Aumentá inversión o amplía audiencia." },
          { range: "10+",   meaning: "Volumen saludable para optimizar sobre datos reales." },
        ],
      },
    },
    {
      key: "roas",
      label: "ROAS",
      value: `${totals.roas.toFixed(2)}x`,
      delta: deltas.roas,
      betterWhen: "higher",
      help: {
        title: "ROAS (Return on Ad Spend)",
        what: "Cuántos dólares generás por cada dólar invertido en pauta.",
        formula: "Ingresos ÷ Gasto",
        interpretation: [
          { range: "< 1x",  meaning: "Estás perdiendo dinero. Pausá o rediseñá urgente." },
          { range: "1-2x",  meaning: "Rentabilidad ajustada. Optimizá creativos o audiencia." },
          { range: "2-4x",  meaning: "Saludable. Punto óptimo para escalar." },
          { range: "> 4x",  meaning: "Excelente. Considerá subir presupuesto." },
        ],
        action: "El benchmark saludable depende del margen de tu producto. Para e-commerce ≥3x es la referencia.",
      },
    },
    {
      key: "clicks",
      label: "CTR",
      value: fmtPct(totals.ctr),
      delta: deltas.ctr,
      betterWhen: "higher",
      help: {
        title: "CTR (Click-Through Rate)",
        what: "Porcentaje de personas que hicieron clic tras ver tu anuncio. Mide qué tan atractivo es el creativo.",
        formula: "(Clicks ÷ Impresiones) × 100",
        interpretation: [
          { range: "< 1%",  meaning: "Bajo. El creativo no resuena o la segmentación es incorrecta." },
          { range: "1-2%",  meaning: "Aceptable. Hay espacio para mejorar copy o imagen." },
          { range: "> 2%",  meaning: "Excelente. Tu mensaje conecta con la audiencia." },
        ],
        action: "Si cae abruptamente, rotá creativos. Los anuncios se 'queman' por fatiga de audiencia.",
      },
    },
    {
      key: "conversions",
      label: "Conv. Rate",
      value: `${conversionRate.toFixed(2)}%`,
      delta: convRateDelta,
      betterWhen: "higher",
      help: {
        title: "Tasa de Conversión",
        what: "De cada 100 personas que hacen clic, cuántas convierten. Mide qué tan bien tu landing/producto convierte al tráfico pago.",
        formula: "(Conversiones ÷ Clicks) × 100",
        interpretation: [
          { range: "< 1%",  meaning: "Landing débil, producto no diferenciado o mismatch con el anuncio." },
          { range: "1-3%",  meaning: "Rango típico para e-commerce." },
          { range: "> 3%",  meaning: "Excelente. Tu funnel está afinado." },
        ],
        action: "Si CTR es alto pero Conv Rate bajo, el problema está en la landing, no en el anuncio.",
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi, i) => (
        <KpiCard key={i} kpi={kpi} daily={daily} />
      ))}
    </div>
  );
}

function KpiCard({ kpi, daily }: { kpi: KpiConfig; daily: DailyPoint[] }) {
  const isPositive = kpi.betterWhen === "higher" ? kpi.delta >= 0 : kpi.delta <= 0;
  const isNeutral = Math.abs(kpi.delta) < 0.5;
  const color = isNeutral ? "hsl(var(--muted-foreground))" : isPositive ? "hsl(142 70% 45%)" : "hsl(0 75% 55%)";
  const sparkData = daily.map((d) => ({ v: Number(d[kpi.key] || 0) }));

  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-1 mb-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{kpi.label}</p>
          <MetricHelp {...kpi.help} />
        </div>
        <p className="text-2xl font-bold tabular-nums leading-tight">{kpi.value}</p>
        <div className="flex items-center gap-1 mt-1">
          {isNeutral ? (
            <Minus className="h-3 w-3 text-muted-foreground" />
          ) : isPositive ? (
            <ArrowUp className="h-3 w-3" style={{ color }} />
          ) : (
            <ArrowDown className="h-3 w-3" style={{ color }} />
          )}
          <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
            {kpi.delta >= 0 ? "+" : ""}{kpi.delta.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground">vs anterior</span>
        </div>
        {/* Sparkline overlay */}
        <div className="h-10 -mx-4 -mb-3 mt-2 opacity-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${kpi.label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#spark-${kpi.label})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default KpiGridWithSparklines;