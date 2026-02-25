import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { List, Kanban, TrendingUp, CalendarIcon, X } from "lucide-react";
import { Acuerdo } from "@/types/crm";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "kanban" | "forecast";

export interface DateRange {
  from?: Date;
  to?: Date;
}

interface ViewToolbarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  acuerdos: Acuerdo[];
  selectedAcuerdo: string;
  onAcuerdoChange: (v: string) => void;
  showForecast?: boolean;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

export default function ViewToolbar({
  view,
  onViewChange,
  acuerdos,
  selectedAcuerdo,
  onAcuerdoChange,
  showForecast = true,
  dateRange,
  onDateRangeChange,
}: ViewToolbarProps) {
  const hasDateFilter = dateRange?.from || dateRange?.to;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1">
        <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => onViewChange("list")} className="h-8 px-3">
          <List className="h-4 w-4 mr-1" /> Lista
        </Button>
        <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" onClick={() => onViewChange("kanban")} className="h-8 px-3">
          <Kanban className="h-4 w-4 mr-1" /> Kanban
        </Button>
        {showForecast && (
          <Button variant={view === "forecast" ? "default" : "ghost"} size="sm" onClick={() => onViewChange("forecast")} className="h-8 px-3">
            <TrendingUp className="h-4 w-4 mr-1" /> Forecast
          </Button>
        )}
      </div>

      <Select value={selectedAcuerdo} onValueChange={onAcuerdoChange}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Filtrar por influencer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los influencers</SelectItem>
          {acuerdos.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.influencer} — {(Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).join(", ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {onDateRangeChange && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 px-3 text-sm", hasDateFilter && "border-primary text-primary")}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {dateRange?.from
                  ? dateRange.to
                    ? `${format(dateRange.from, "dd MMM yyyy", { locale: es })} — ${format(dateRange.to, "dd MMM yyyy", { locale: es })}`
                    : `Desde ${format(dateRange.from, "dd MMM yyyy", { locale: es })}`
                  : "Filtrar por fechas"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange?.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                onSelect={(range) => onDateRangeChange({ from: range?.from, to: range?.to })}
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {hasDateFilter && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDateRangeChange({})}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
