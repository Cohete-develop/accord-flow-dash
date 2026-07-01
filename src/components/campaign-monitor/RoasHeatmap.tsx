import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricHelp } from "./MetricHelp";
import type { DailyPoint } from "@/hooks/useResumenAnalytics";
import { cn } from "@/lib/utils";

interface Props {
  daily: DailyPoint[];
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Heatmap de ROAS por día de la semana × semana del rango.
 * Ejes: Y = días (Lun..Dom), X = semanas. Color = intensidad de ROAS.
 */
export function RoasHeatmap({ daily }: Props) {
  const grid = useMemo(() => {
    if (daily.length === 0) return { weeks: [], maxRoas: 0, avgByDow: [] as number[] };

    // Determine week index relative to earliest date; ISO Monday-first.
    const parseDate = (s: string) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    const first = parseDate(daily[0].date);
    // Snap to Monday of first week
    const firstDow = (first.getDay() + 6) % 7; // 0 = Monday
    const weekStart = new Date(first);
    weekStart.setDate(first.getDate() - firstDow);

    const cellMap = new Map<string, DailyPoint>();
    daily.forEach((d) => cellMap.set(d.date, d));

    // Compute how many weeks span the range
    const last = parseDate(daily[daily.length - 1].date);
    const totalDays = Math.ceil((last.getTime() - weekStart.getTime()) / 86400000) + 1;
    const totalWeeks = Math.ceil(totalDays / 7);

    const weeks: Array<{
      label: string;
      days: Array<{ date: string | null; roas: number; cost: number; revenue: number; empty: boolean }>;
    }> = [];

    for (let w = 0; w < totalWeeks; w++) {
      const monday = new Date(weekStart);
      monday.setDate(weekStart.getDate() + w * 7);
      const label = `${monday.getDate()}/${monday.getMonth() + 1}`;
      const days = [];
      for (let dow = 0; dow < 7; dow++) {
        const cell = new Date(monday);
        cell.setDate(monday.getDate() + dow);
        const iso = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(cell.getDate()).padStart(2, "0")}`;
        const point = cellMap.get(iso);
        days.push({
          date: point ? iso : null,
          roas: point?.roas ?? 0,
          cost: point?.cost ?? 0,
          revenue: point?.revenue ?? 0,
          empty: !point,
        });
      }
      weeks.push({ label, days });
    }

    const allRoas = daily.map((d) => d.roas).filter((v) => v > 0);
    const maxRoas = allRoas.length ? Math.max(...allRoas) : 0;

    // avg ROAS per day-of-week
    const dowBuckets: Array<{ sum: number; n: number }> = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    daily.forEach((d) => {
      const dd = parseDate(d.date);
      const dow = (dd.getDay() + 6) % 7;
      if (d.roas > 0) {
        dowBuckets[dow].sum += d.roas;
        dowBuckets[dow].n += 1;
      }
    });
    const avgByDow = dowBuckets.map((b) => (b.n > 0 ? b.sum / b.n : 0));

    return { weeks, maxRoas, avgByDow };
  }, [daily]);

  const bestDow = grid.avgByDow.indexOf(Math.max(...grid.avgByDow));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-base">Heatmap ROAS · día × semana</CardTitle>
          <MetricHelp
            title="Heatmap de ROAS"
            what="Muestra tu retorno por dólar invertido, cruzando día de la semana (vertical) con cada semana del rango (horizontal). Los cuadros más verdes son días más rentables."
            formula="Color ∝ ROAS del día ÷ ROAS máximo del período"
            interpretation="Buscá patrones: si los sábados son consistentemente verdes, subí presupuesto los sábados. Si los lunes son rojos, bajálo o pausá."
            action="Ajustá pujas por horario/día en Google Ads y Meta según los ganadores. Un patrón claro puede subir el ROAS global 20-30%."
          />
        </div>
        {bestDow >= 0 && grid.avgByDow[bestDow] > 0 && (
          <p className="text-xs text-muted-foreground">
            Mejor día promedio: <span className="font-semibold text-green-500">{DAY_LABELS[bestDow]}</span> ({grid.avgByDow[bestDow].toFixed(2)}x ROAS)
          </p>
        )}
      </CardHeader>
      <CardContent>
        {grid.weeks.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">Sin datos para graficar</div>
        ) : (
          <div className="flex gap-3">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-around pt-6 pr-1">
              {DAY_LABELS.map((d, i) => (
                <div key={d} className={cn("text-[10px] text-muted-foreground h-6 flex items-center",
                  i === bestDow && "text-green-500 font-semibold")}>{d}</div>
              ))}
            </div>
            {/* Grid */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {grid.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    <div className="text-[9px] text-muted-foreground text-center h-4">{week.label}</div>
                    {week.days.map((cell, di) => (
                      <HeatmapCell key={di} cell={cell} maxRoas={grid.maxRoas} dow={di} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-col justify-end gap-1 pl-2 border-l">
              <div className="text-[10px] text-muted-foreground mb-1">ROAS</div>
              {[1, 0.75, 0.5, 0.25, 0.05].map((intensity) => (
                <div key={intensity} className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm" style={{ background: colorFor(intensity) }} />
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {(intensity * grid.maxRoas).toFixed(1)}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function colorFor(intensity: number): string {
  if (intensity <= 0) return "hsl(var(--muted))";
  // Green gradient scaled by intensity 0-1
  const alpha = 0.15 + intensity * 0.75;
  return `hsla(142, 70%, 45%, ${alpha})`;
}

function HeatmapCell({ cell, maxRoas, dow }: { cell: { date: string | null; roas: number; cost: number; revenue: number; empty: boolean }; maxRoas: number; dow: number }) {
  const intensity = maxRoas > 0 ? Math.min(cell.roas / maxRoas, 1) : 0;
  const bg = cell.empty ? "hsl(var(--muted) / 0.3)" : colorFor(intensity);
  const title = cell.empty
    ? "Sin datos"
    : `${cell.date} · ROAS ${cell.roas.toFixed(2)}x · Gasto $${cell.cost.toFixed(0)} · Ingresos $${cell.revenue.toFixed(0)}`;
  return (
    <div
      className="h-6 w-6 rounded-sm border border-border/30 hover:ring-2 hover:ring-primary/40 transition-all cursor-help"
      style={{ background: bg }}
      title={title}
      data-dow={dow}
    />
  );
}

export default RoasHeatmap;