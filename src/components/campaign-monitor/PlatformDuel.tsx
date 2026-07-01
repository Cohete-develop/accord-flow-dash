import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Swords } from "lucide-react";
import { MetricHelp } from "./MetricHelp";
import { cn } from "@/lib/utils";
import { PLATFORM_COLORS, PLATFORM_LABELS, fmtMoney, fmtNum, fmtPct } from "./utils";
import type { PlatformSeries } from "@/hooks/useResumenAnalytics";
import type { Platform } from "@/hooks/useCampaignMonitor";

interface Props {
  platforms: PlatformSeries[];
}

type RowKey = "cost" | "revenue" | "roas" | "conversions" | "ctr" | "cpa" | "cpc";
const HIGHER_BETTER: Record<RowKey, boolean> = {
  cost: false, revenue: true, roas: true, conversions: true, ctr: true, cpa: false, cpc: false,
};
const ROW_META: Record<RowKey, { label: string; help: { what: string; formula?: string; interpretation?: string; action?: string } }> = {
  cost:        { label: "Gasto",       help: { what: "Total invertido en la plataforma en el período.", interpretation: "Comparar en conjunto con revenue y ROAS — gastar más no es malo si el retorno acompaña." } },
  revenue:     { label: "Ingresos",    help: { what: "Valor total de conversiones atribuido a la plataforma.", interpretation: "El ganador aquí genera más facturación bruta, aunque no siempre es el más rentable." } },
  roas:        { label: "ROAS",        help: { what: "Retorno por cada dólar invertido.", formula: "ingresos ÷ gasto", interpretation: ">2x es rentable; >4x es candidato a escalar.", action: "Movele presupuesto al ganador si su volumen aguanta." } },
  conversions: { label: "Conversiones", help: { what: "Cantidad de acciones valiosas completadas (ventas, leads).", interpretation: "Volumen de resultados, sin importar el valor por conversión." } },
  ctr:         { label: "CTR",         help: { what: "Porcentaje de impresiones que generaron clic.", formula: "clicks ÷ impresiones × 100", interpretation: ">2% es fuerte. CTR bajo suele indicar creativo o audiencia débil." } },
  cpa:         { label: "CPA",         help: { what: "Costo por adquisición.", formula: "gasto ÷ conversiones", interpretation: "Menor es mejor, siempre relativo al ticket promedio." } },
  cpc:         { label: "CPC",         help: { what: "Costo por clic.", formula: "gasto ÷ clicks", interpretation: "Baja competencia o buen quality score = CPC bajo." } },
};

function getVal(p: PlatformSeries, k: RowKey): number {
  const t = p.totals;
  switch (k) {
    case "cost": return t.cost;
    case "revenue": return t.conversion_value;
    case "roas": return t.roas;
    case "conversions": return t.conversions;
    case "ctr": return t.ctr;
    case "cpa": return t.cpa;
    case "cpc": return t.cpc;
  }
}

function fmt(k: RowKey, v: number): string {
  if (v === 0 && (k === "cpa" || k === "cpc")) return "—";
  switch (k) {
    case "cost":
    case "revenue":
    case "cpa":
    case "cpc":
      return fmtMoney(v);
    case "conversions":
      return fmtNum(v);
    case "ctr":
      return fmtPct(v);
    case "roas":
      return `${v.toFixed(2)}x`;
  }
}

export function PlatformDuel({ platforms }: Props) {
  const { left, right, rows, leftWins, rightWins } = useMemo(() => {
    // Prefer Google vs Meta; fallback to top-2 by cost
    const priority: Platform[] = ["google_ads", "meta_ads", "tiktok_ads", "linkedin_ads"];
    const sorted = [...platforms].sort(
      (a, b) => priority.indexOf(a.platform) - priority.indexOf(b.platform),
    );
    const google = sorted.find((p) => p.platform === "google_ads");
    const meta = sorted.find((p) => p.platform === "meta_ads");
    const [left, right] =
      google && meta ? [google, meta] : [sorted[0], sorted[1]];

    const rowKeys: RowKey[] = ["cost", "revenue", "roas", "conversions", "ctr", "cpa", "cpc"];
    let lw = 0, rw = 0;
    const rows = rowKeys.map((k) => {
      const lv = left ? getVal(left, k) : 0;
      const rv = right ? getVal(right, k) : 0;
      let winner: "left" | "right" | "tie" = "tie";
      if (lv > 0 || rv > 0) {
        const higherBetter = HIGHER_BETTER[k];
        if (lv === rv) winner = "tie";
        else if (higherBetter) winner = lv > rv ? "left" : "right";
        else winner = (lv > 0 ? lv : Infinity) < (rv > 0 ? rv : Infinity) ? "left" : "right";
      }
      if (winner === "left") lw++; else if (winner === "right") rw++;
      return { key: k, lv, rv, winner };
    });
    return { left, right, rows, leftWins: lw, rightWins: rw };
  }, [platforms]);

  if (!left || !right) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Swords className="h-4 w-4" /> Duelo de plataformas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Se necesitan al menos 2 plataformas con datos para comparar.
        </CardContent>
      </Card>
    );
  }

  const overall: "left" | "right" | "tie" =
    leftWins > rightWins ? "left" : rightWins > leftWins ? "right" : "tie";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Swords className="h-4 w-4 text-primary" />
            Duelo de plataformas
            <MetricHelp
              title="Duelo head-to-head"
              what="Comparación métrica por métrica entre dos plataformas. Un ✓ marca al ganador en cada fila según si más o menos es mejor."
              interpretation="El ganador global es quien lleva más filas. Sirve para decidir a dónde mover presupuesto."
              action="Si una plataforma gana ROAS y CPA, es la candidata para escalar. Si gana solo volumen, revisá rentabilidad antes de mover plata."
            />
          </CardTitle>
          <Badge variant={overall === "tie" ? "secondary" : "default"} className="gap-1">
            <Trophy className="h-3 w-3" />
            {overall === "tie"
              ? "Empate técnico"
              : `Gana ${overall === "left" ? PLATFORM_LABELS[left.platform] : PLATFORM_LABELS[right.platform]}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1 items-center">
          <PlatformHeader p={left} align="right" score={leftWins} />
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">vs</div>
          <PlatformHeader p={right} align="left" score={rightWins} />

          {rows.map((r) => {
            const meta = ROW_META[r.key];
            return (
              <div key={r.key} className="contents">
                <div
                  className={cn(
                    "px-2 py-1.5 text-right tabular-nums rounded-md text-sm",
                    r.winner === "left" && "bg-primary/10 font-semibold text-foreground",
                    r.winner === "right" && "text-muted-foreground",
                  )}
                >
                  {r.winner === "left" && <span className="text-green-500 mr-1">✓</span>}
                  {fmt(r.key, r.lv)}
                </div>
                <div className="text-[11px] text-muted-foreground text-center whitespace-nowrap flex items-center justify-center gap-1">
                  {meta.label}
                  <MetricHelp title={meta.label} {...meta.help} iconClassName="h-3 w-3" />
                </div>
                <div
                  className={cn(
                    "px-2 py-1.5 text-left tabular-nums rounded-md text-sm",
                    r.winner === "right" && "bg-primary/10 font-semibold text-foreground",
                    r.winner === "left" && "text-muted-foreground",
                  )}
                >
                  {fmt(r.key, r.rv)}
                  {r.winner === "right" && <span className="text-green-500 ml-1">✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformHeader({ p, align, score }: { p: PlatformSeries; align: "left" | "right"; score: number }) {
  return (
    <div className={cn("flex flex-col gap-0.5", align === "right" ? "items-end" : "items-start")}>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: PLATFORM_COLORS[p.platform] }}
        />
        <span className="font-semibold text-sm">{PLATFORM_LABELS[p.platform]}</span>
      </div>
      <span className="text-[11px] text-muted-foreground">{score} triunfo{score === 1 ? "" : "s"}</span>
    </div>
  );
}

export default PlatformDuel;