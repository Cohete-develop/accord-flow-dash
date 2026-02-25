import { useState, useCallback, useMemo } from "react";

export function useColumnVisibility(columnKeys: string[]) {
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const toggleColumn = useCallback((key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setHiddenColumns(new Set());
  }, []);

  const isVisible = useCallback(
    (key: string) => !hiddenColumns.has(key),
    [hiddenColumns]
  );

  const visibleCount = useMemo(
    () => columnKeys.filter((k) => !hiddenColumns.has(k)).length,
    [columnKeys, hiddenColumns]
  );

  return { hiddenColumns, toggleColumn, showAll, isVisible, visibleCount };
}
