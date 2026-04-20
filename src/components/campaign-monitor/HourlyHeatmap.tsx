import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignMetric } from "@/hooks/useCampaignMonitor";

interface Props {
  metrics: CampaignMetric[];
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function HourlyHeatmap({ metrics }: Props) {
  const { grid, max, hasHourly } = useMemo(() => {
    // grid[day 0-6][hour 0-23] = sum conversions
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let hasHour = false;
    metrics.forEach((m) => {
      if (m.hour === null || m.hour === undefined) return;
      hasHour = true;
      const d = new Date(m.date + "T00:00:00").getDay();
      g[d][m.hour] += Number(m.conversions);
    });
    let mx = 0;
    g.forEach((row) => row.forEach((v) => { if (v > mx) mx = v; }));
    return { grid: g, max: mx, hasHourly: hasHour };
  }, [metrics]);

  const cellColor = (v: number) => {
    if (max === 0 || v === 0) return "hsl(var(--muted) / 0.3)";
    const intensity = v / max; // 0..1
    // de azul claro a azul oscuro
    const lightness = 85 - intensity * 50; // 85 -> 35
    return `hsl(217 91% ${lightness}%)`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Heatmap horario — Conversiones por día/hora</CardTitle>
        <p className="text-xs text-muted-foreground">
          {hasHourly
            ? "Más oscuro = más conversiones. Identifica las franjas horarias con mejor rendimiento."
            : "Sin datos horarios disponibles aún."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block">
            {/* Header de horas */}
            <div className="flex">
              <div className="w-10 shrink-0" />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="w-6 text-center text-[10px] text-muted-foreground">
                  {h % 3 === 0 ? h : ""}
                </div>
              ))}
            </div>
            {/* Filas por día */}
            {DAYS.map((day, dIdx) => (
              <div key={day} className="flex items-center mt-0.5">
                <div className="w-10 shrink-0 text-xs text-muted-foreground pr-2 text-right">{day}</div>
                {grid[dIdx].map((v, h) => (
                  <div
                    key={h}
                    className="w-6 h-6 border border-background"
                    style={{ background: cellColor(v) }}
                    title={`${day} ${h}:00 — ${v} conversiones`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <span>Menos</span>
          <div className="flex">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
              <div key={i} className="w-5 h-3" style={{ background: `hsl(217 91% ${85 - i * 50}%)` }} />
            ))}
          </div>
          <span>Más</span>
          {max > 0 && <span className="ml-2">(máx {max})</span>}
        </div>
      </CardContent>
    </Card>
  );
}