import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricHelp } from "./MetricHelp";
import { fmtMoney, fmtNum } from "./utils";
import type { MetricTotals } from "./utils";
import { cn } from "@/lib/utils";

interface Props {
  totals: MetricTotals;
}

/**
 * Funnel visual de 4 etapas con drop-off entre cada una y tooltips explicativos.
 * Impresiones → Clicks → Conversiones → Ingresos (usando conversion_value).
 */
export function ConversionFunnelDeluxe({ totals }: Props) {
  const { impressions, clicks, conversions, conversion_value: revenue } = totals;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
  const aov = conversions > 0 ? revenue / conversions : 0;

  // Widths shrink relative to first stage. Revenue stage width mirrors conv%.
  const wImpr = 100;
  const wClicks = impressions > 0 ? Math.max((clicks / impressions) * 100, 4) : 4;
  const wConv = impressions > 0 ? Math.max((conversions / impressions) * 100 * 20, 4) : 4; // *20 for visibility
  const wRev = impressions > 0 ? Math.max((conversions / impressions) * 100 * 20, 4) : 4;

  const stages = [
    { label: "Impresiones", value: fmtNum(impressions), w: wImpr, color: "hsl(217 91% 60%)", sub: "Alcance total" },
    { label: "Clicks",      value: fmtNum(clicks),      w: wClicks, color: "hsl(262 83% 58%)", sub: "Interés" },
    { label: "Conversiones",value: fmtNum(conversions), w: wConv,  color: "hsl(142 70% 45%)", sub: "Acción completada" },
    { label: "Ingresos",    value: fmtMoney(revenue),   w: wRev,   color: "hsl(38 90% 55%)",  sub: "Valor generado" },
  ];

  const drops = [
    { label: "CTR", value: `${ctr.toFixed(2)}%`, tone: ctr < 1 ? "bad" : ctr < 2 ? "warn" : "good" as const },
    { label: "Conv. rate", value: `${convRate.toFixed(2)}%`, tone: convRate < 1 ? "bad" : convRate < 3 ? "warn" : "good" as const },
    { label: "Ticket promedio", value: fmtMoney(aov), tone: "neutral" as const },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-base">Funnel de conversión</CardTitle>
          <MetricHelp
            title="Funnel de conversión"
            what="Muestra cómo se filtran los usuarios desde que ven tu anuncio hasta que generan ingreso. Cada etapa es un embudo: siempre queda menos gente que en la anterior."
            interpretation="La magia está en las tasas entre etapas. Un funnel sano pierde poco en cada paso relativo a los benchmarks."
            action="Identificá la etapa con mayor caída y trabajá primero ahí: creativo (Impr→Clicks), landing (Clicks→Conv), pricing (Conv→Ingresos)."
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((s, i) => (
          <div key={s.label}>
            <div className="flex justify-between items-baseline text-xs mb-1">
              <div>
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground ml-2 text-[11px]">{s.sub}</span>
              </div>
              <span className="font-mono font-semibold">{s.value}</span>
            </div>
            <div className="relative h-9 bg-muted/30 rounded-md overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-md transition-all"
                style={{ width: `${s.w}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}dd)` }}
              />
            </div>
            {i < stages.length - 1 && (
              <div className="flex items-center gap-2 mt-1 pl-2 text-[11px]">
                <span className="text-muted-foreground">↓</span>
                <span className={cn("font-semibold tabular-nums",
                  drops[i].tone === "good" ? "text-green-500"
                  : drops[i].tone === "warn" ? "text-amber-500"
                  : drops[i].tone === "bad" ? "text-destructive"
                  : "text-muted-foreground",
                )}>{drops[i].value}</span>
                <span className="text-muted-foreground">{drops[i].label}</span>
                <MetricHelp
                  side="right"
                  {...(drops[i].label === "CTR" ? {
                    title: "CTR (Click-Through Rate)",
                    what: "Qué porcentaje de las impresiones se convirtieron en clic.",
                    formula: "(Clicks ÷ Impresiones) × 100",
                    interpretation: [
                      { range: "< 1%",  meaning: "Bajo. Cambiá creativo o segmentación." },
                      { range: "1-2%",  meaning: "Aceptable." },
                      { range: "> 2%",  meaning: "Excelente." },
                    ],
                  } : drops[i].label === "Conv. rate" ? {
                    title: "Tasa de conversión",
                    what: "De cada 100 personas que hicieron clic, cuántas convirtieron.",
                    formula: "(Conversiones ÷ Clicks) × 100",
                    interpretation: [
                      { range: "< 1%",  meaning: "Landing débil o mismatch con anuncio." },
                      { range: "1-3%",  meaning: "Rango típico e-commerce." },
                      { range: "> 3%",  meaning: "Funnel muy afinado." },
                    ],
                  } : {
                    title: "Ticket promedio (AOV)",
                    what: "Ingreso promedio por conversión.",
                    formula: "Ingresos ÷ Conversiones",
                    interpretation: "Subirlo (cross-sell, bundles) suele ser más rentable que bajar CPA.",
                  })}
                />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default ConversionFunnelDeluxe;