import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface KanbanColumn {
  key: string;
  label: string;
  colorClass: string;
}

interface KanbanBoardProps<T> {
  items: T[];
  columns: KanbanColumn[];
  getId: (item: T) => string;
  getStatus: (item: T) => string;
  getValue: (item: T) => number;
  renderCard: (item: T) => React.ReactNode;
  onStatusChange: (item: T, newStatus: string) => void;
  onCardClick?: (item: T) => void;
  valuePrefix?: string;
}

export default function KanbanBoard<T>({
  items,
  columns,
  getId,
  getStatus,
  getValue,
  renderCard,
  onStatusChange,
  onCardClick,
  valuePrefix = "$",
}: KanbanBoardProps<T>) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ item: T; newStatus: string } | null>(null);
  const dragItem = useRef<T | null>(null);

  const handleDragStart = (item: T) => {
    dragItem.current = item;
  };

  const handleDrop = (columnKey: string) => {
    if (dragItem.current && getStatus(dragItem.current) !== columnKey) {
      setPendingMove({ item: dragItem.current, newStatus: columnKey });
      setConfirmOpen(true);
    }
    dragItem.current = null;
  };

  const confirmMove = () => {
    if (pendingMove) {
      onStatusChange(pendingMove.item, pendingMove.newStatus);
    }
    setConfirmOpen(false);
    setPendingMove(null);
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colItems = items.filter((i) => getStatus(i) === col.key);
          const total = colItems.reduce((sum, i) => sum + getValue(i), 0);

          return (
            <div
              key={col.key}
              className="flex-1 min-w-[260px] flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}
            >
              <div className={`rounded-t-lg px-4 py-3 ${col.colorClass}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{col.label}</span>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {colItems.length}
                  </Badge>
                </div>
                <div className="text-lg font-bold mt-1">
                  {valuePrefix}{total.toLocaleString()}
                </div>
              </div>
              <div className="bg-muted/40 rounded-b-lg p-2 flex-1 space-y-2 min-h-[200px] border border-t-0 border-border">
                {colItems.map((item) => (
                  <div
                    key={getId(item)}
                    draggable
                    onDragStart={() => handleDragStart(item)}
                    className="cursor-grab active:cursor-grabbing"
                    onClick={() => onCardClick?.(item)}
                  >
                    <Card className="shadow-sm hover:shadow-md transition-shadow hover:ring-2 hover:ring-primary/30">
                      <CardContent className="p-3 text-sm">
                        {renderCard(item)}
                      </CardContent>
                    </Card>
                  </div>
                ))}
                {colItems.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8">
                    Arrastra aquí
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar cambio de estado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Deseas mover este registro a{" "}
            <strong>{pendingMove ? columns.find((c) => c.key === pendingMove.newStatus)?.label : ""}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={confirmMove}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
