import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ForecastBoardProps<T> {
  items: T[];
  getDate: (item: T) => string;
  getValue: (item: T) => number;
  renderCard: (item: T) => React.ReactNode;
  getId: (item: T) => string;
  valuePrefix?: string;
  emptyLabel?: string;
}

function getMonthKey(dateStr: string): string {
  if (!dateStr) return "Sin fecha";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Sin fecha";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(key: string): string {
  if (key === "Sin fecha") return key;
  const [y, m] = key.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export default function ForecastBoard<T>({
  items,
  getDate,
  getValue,
  renderCard,
  getId,
  valuePrefix = "$",
  emptyLabel = "No hay registros",
}: ForecastBoardProps<T>) {
  const grouped: Record<string, T[]> = {};
  items.forEach((item) => {
    const key = getMonthKey(getDate(item));
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Sin fecha") return 1;
    if (b === "Sin fecha") return -1;
    return a.localeCompare(b);
  });

  // Filter to current and future months only
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const futureKeys = sortedKeys.filter((k) => k >= currentKey || k === "Sin fecha");
  const displayKeys = futureKeys.length > 0 ? futureKeys : sortedKeys;

  if (displayKeys.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">{emptyLabel}</div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {displayKeys.map((key) => {
        const colItems = grouped[key] || [];
        const total = colItems.reduce((sum, i) => sum + getValue(i), 0);

        return (
          <div key={key} className="flex-1 min-w-[260px] flex flex-col">
            <div className="rounded-t-lg px-4 py-3 bg-primary/10 text-primary">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{formatMonth(key)}</span>
                <Badge variant="secondary" className="text-xs font-mono">{colItems.length}</Badge>
              </div>
              <div className="text-lg font-bold mt-1">
                {valuePrefix}{total.toLocaleString()}
              </div>
            </div>
            <div className="bg-muted/40 rounded-b-lg p-2 flex-1 space-y-2 min-h-[200px] border border-t-0 border-border">
              {colItems.map((item) => (
                <Card key={getId(item)} className="shadow-sm">
                  <CardContent className="p-3 text-sm">{renderCard(item)}</CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
