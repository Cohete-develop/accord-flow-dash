import { useState, useCallback, useRef, useEffect } from "react";

export function useResizableColumns(columnKeys: string[], defaultWidth = 120) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    columnKeys.forEach((key) => {
      widths[key] = defaultWidth;
    });
    return widths;
  });

  // Update widths when column keys change
  useEffect(() => {
    setColumnWidths((prev) => {
      const widths: Record<string, number> = {};
      columnKeys.forEach((key) => {
        widths[key] = prev[key] || defaultWidth;
      });
      return widths;
    });
  }, [columnKeys.join(","), defaultWidth]);

  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, key: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = columnWidths[key] || defaultWidth;
      resizingRef.current = { key, startX, startWidth };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const diff = ev.clientX - resizingRef.current.startX;
        const newWidth = Math.max(60, resizingRef.current.startWidth + diff);
        setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.key]: newWidth }));
      };

      const handleMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [columnWidths, defaultWidth]
  );

  return { columnWidths, handleResizeStart };
}
