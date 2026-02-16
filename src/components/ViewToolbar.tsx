import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { List, Kanban, TrendingUp } from "lucide-react";
import { Acuerdo } from "@/types/crm";

export type ViewMode = "list" | "kanban" | "forecast";

interface ViewToolbarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  acuerdos: Acuerdo[];
  selectedAcuerdo: string;
  onAcuerdoChange: (v: string) => void;
  showForecast?: boolean;
}

export default function ViewToolbar({
  view,
  onViewChange,
  acuerdos,
  selectedAcuerdo,
  onAcuerdoChange,
  showForecast = true,
}: ViewToolbarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1">
        <Button
          variant={view === "list" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewChange("list")}
          className="h-8 px-3"
        >
          <List className="h-4 w-4 mr-1" /> Lista
        </Button>
        <Button
          variant={view === "kanban" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewChange("kanban")}
          className="h-8 px-3"
        >
          <Kanban className="h-4 w-4 mr-1" /> Kanban
        </Button>
        {showForecast && (
          <Button
            variant={view === "forecast" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewChange("forecast")}
            className="h-8 px-3"
          >
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
              {a.influencer} — {a.redSocial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
