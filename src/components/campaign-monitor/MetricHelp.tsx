import { HelpCircle } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export interface MetricHelpProps {
  title: string;
  what: string;
  formula?: string;
  interpretation?: string | Array<{ range: string; meaning: string }>;
  action?: string;
  className?: string;
  iconClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Tooltip explicativo reutilizable para métricas y gráficos del Campaign Monitor.
 * Muestra al hover: qué mide, cómo se calcula, cómo interpretarlo y qué acción tomar.
 */
export function MetricHelp({
  title,
  what,
  formula,
  interpretation,
  action,
  className,
  iconClassName,
  side = "top",
}: MetricHelpProps) {
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`Ayuda: ${title}`}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
            className,
          )}
        >
          <HelpCircle className={cn("h-3.5 w-3.5", iconClassName)} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent side={side} align="start" className="w-80 text-xs space-y-2">
        <div className="font-semibold text-sm text-foreground">{title}</div>
        <p className="text-muted-foreground leading-relaxed">{what}</p>

        {formula && (
          <div className="rounded-md bg-muted/60 border border-border/50 px-2 py-1.5 font-mono text-[11px] text-foreground/90">
            {formula}
          </div>
        )}

        {interpretation && (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80 font-medium">
              Cómo interpretarlo
            </div>
            {typeof interpretation === "string" ? (
              <p className="text-muted-foreground leading-relaxed">{interpretation}</p>
            ) : (
              <ul className="space-y-0.5">
                {interpretation.map((it, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-foreground/90 shrink-0">{it.range}</span>
                    <span className="text-muted-foreground">{it.meaning}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {action && (
          <div className="pt-1 border-t border-border/50">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80 font-medium mb-0.5">
              Qué hacer
            </div>
            <p className="text-muted-foreground leading-relaxed">{action}</p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export default MetricHelp;