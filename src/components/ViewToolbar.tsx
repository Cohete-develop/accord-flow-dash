import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { List, Kanban, TrendingUp, CalendarIcon, X, Download, SlidersHorizontal } from "lucide-react";
import { Acuerdo } from "@/types/crm";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "kanban" | "forecast";

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface ColumnOption {
  key: string;
  label: string;
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
  onExport?: (format: "xlsx" | "csv") => void;
  columns?: ColumnOption[];
  isColumnVisible?: (key: string) => boolean;
  onToggleColumn?: (key: string) => void;
  onShowAllColumns?: () => void;
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
  onExport,
  columns,
  isColumnVisible,
  onToggleColumn,
  onShowAllColumns,
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

      <div className="ml-auto flex items-center gap-2">
        {view === "list" && columns && isColumnVisible && onToggleColumn && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 text-sm">
                <SlidersHorizontal className="h-4 w-4 mr-2" /> Columnas
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Columnas visibles</span>
                  {onShowAllColumns && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={onShowAllColumns}>
                      Mostrar todas
                    </Button>
                  )}
                </div>
                {columns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-1 rounded hover:bg-muted/50">
                    <Checkbox
                      checked={isColumnVisible(col.key)}
                      onCheckedChange={() => onToggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {view === "list" && onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 text-sm">
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport("xlsx")}>
                Exportar a Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("csv")}>
                Exportar a CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
