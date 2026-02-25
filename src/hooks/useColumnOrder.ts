import { useState, useCallback, DragEvent } from "react";

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortKey?: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

export function useColumnOrder<T>(initialColumns: ColumnDef<T>[]) {
  const [columnOrder, setColumnOrder] = useState<string[]>(initialColumns.map(c => c.key));
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  const orderedColumns = columnOrder
    .map(key => initialColumns.find(c => c.key === key))
    .filter(Boolean) as ColumnDef<T>[];

  const handleDragStart = useCallback((e: DragEvent, key: string) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  }, []);

  const handleDragOver = useCallback((e: DragEvent, targetKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: DragEvent, targetKey: string) => {
    e.preventDefault();
    const sourceKey = draggedColumn;
    if (!sourceKey || sourceKey === targetKey) {
      setDraggedColumn(null);
      return;
    }
    setColumnOrder(prev => {
      const newOrder = [...prev];
      const sourceIdx = newOrder.indexOf(sourceKey);
      const targetIdx = newOrder.indexOf(targetKey);
      if (sourceIdx === -1 || targetIdx === -1) return prev;
      newOrder.splice(sourceIdx, 1);
      newOrder.splice(targetIdx, 0, sourceKey);
      return newOrder;
    });
    setDraggedColumn(null);
  }, [draggedColumn]);

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
  }, []);

  return {
    orderedColumns,
    draggedColumn,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}
