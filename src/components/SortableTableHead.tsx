import { DragEvent } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export interface SortableTableHeadProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  currentDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  onDragEnd?: () => void;
}

export default function SortableTableHead({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  className,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SortableTableHeadProps) {
  const isActive = currentSortKey === sortKey;

  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", draggable && "cursor-grab", className)}
      onClick={() => onSort(sortKey)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-1">
        {draggable && <GripVertical className="h-3 w-3 opacity-40 flex-shrink-0" />}
        {label}
        {isActive ? (
          currentDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );
}

export function useSort<T>() {
  const sortItems = (items: T[], sortKey: string | null, direction: SortDirection): T[] => {
    if (!sortKey || !direction) return items;
    return [...items].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (Array.isArray(aVal) && Array.isArray(bVal)) {
        const aStr = aVal.join(", ");
        const bStr = bVal.join(", ");
        return direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  };

  const toggleSort = (
    key: string,
    currentKey: string | null,
    currentDir: SortDirection
  ): { sortKey: string | null; sortDirection: SortDirection } => {
    if (currentKey === key) {
      if (currentDir === "asc") return { sortKey: key, sortDirection: "desc" };
      if (currentDir === "desc") return { sortKey: null, sortDirection: null };
    }
    return { sortKey: key, sortDirection: "asc" };
  };

  return { sortItems, toggleSort };
}
