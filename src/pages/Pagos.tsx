import { useState, useEffect, useMemo } from "react";
import { Pago, Acuerdo } from "@/types/crm";
import { useAcuerdos, usePagos } from "@/hooks/useCrmData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import ViewToolbar, { ViewMode, DateRange } from "@/components/ViewToolbar";
import KanbanBoard, { KanbanColumn } from "@/components/KanbanBoard";
import ForecastBoard from "@/components/ForecastBoard";
import SortableTableHead, { SortDirection, useSort } from "@/components/SortableTableHead";
import { useColumnOrder, ColumnDef } from "@/hooks/useColumnOrder";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { exportToFile } from "@/lib/export-utils";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { toast } from "sonner";

const estadoColors: Record<string, string> = {
  Pendiente: "bg-amber-100 text-amber-800",
  Programado: "bg-blue-100 text-blue-800",
  Pagado: "bg-emerald-100 text-emerald-800",
  Vencido: "bg-red-100 text-red-800",
  Cancelado: "bg-slate-100 text-slate-600",
};

const kanbanColumns: KanbanColumn[] = [
  { key: "Pendiente", label: "Pendiente", colorClass: "bg-amber-100 text-amber-800" },
  { key: "Programado", label: "Programado", colorClass: "bg-blue-100 text-blue-800" },
  { key: "Pagado", label: "Pagado", colorClass: "bg-emerald-100 text-emerald-800" },
  { key: "Vencido", label: "Vencido", colorClass: "bg-red-100 text-red-800" },
  { key: "Cancelado", label: "Cancelado", colorClass: "bg-slate-100 text-slate-700" },
];

const emptyPago = (): Omit<Pago, "id" | "createdAt"> => ({
  acuerdoId: "", influencer: "", concepto: "", monto: 0, moneda: "COP",
  fechaPago: "", estado: "Pendiente", metodoPago: "Transferencia", comprobante: "", notas: "",
});

function NumericInput({ value, onChange, ...props }: { value: number; onChange: (v: number) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [display, setDisplay] = useState(value === 0 ? "" : String(value));
  useEffect(() => { setDisplay(value === 0 ? "" : String(value)); }, [value]);
  return (
    <Input
      {...props}
      type="number"
      value={display}
      onChange={(e) => { setDisplay(e.target.value); onChange(e.target.value === "" ? 0 : +e.target.value); }}
      placeholder="0"
    />
  );
}

function filterByDateRange<T>(items: T[], dateRange: DateRange, getDateFields: (item: T) => string[]): T[] {
  if (!dateRange.from && !dateRange.to) return items;
  return items.filter((item) => {
    const dates = getDateFields(item).filter(Boolean).map((d) => new Date(d));
    if (dates.length === 0) return true;
    return dates.some((d) => {
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (d > endOfDay) return false;
      }
      return true;
    });
  });
}

/** Get last business day of a given month (year, month 0-indexed) */
function getLastBusinessDay(year: number, month: number): string {
  const lastDay = new Date(year, month + 1, 0);
  let day = lastDay.getDay();
  if (day === 0) lastDay.setDate(lastDay.getDate() - 2);
  else if (day === 6) lastDay.setDate(lastDay.getDate() - 1);
  return lastDay.toISOString().split("T")[0];
}

/** Generate expected monthly payments for an agreement */
function generatePaymentsForAcuerdo(acuerdo: Acuerdo): Omit<Pago, "id" | "createdAt">[] {
  if (!acuerdo.fechaInicio || acuerdo.duracionMeses <= 0) return [];
  const start = new Date(acuerdo.fechaInicio);
  const payments: Omit<Pago, "id" | "createdAt">[] = [];
  
  for (let i = 0; i < acuerdo.duracionMeses; i++) {
    const month = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const fechaPago = getLastBusinessDay(month.getFullYear(), month.getMonth());
    payments.push({
      acuerdoId: acuerdo.id,
      influencer: acuerdo.influencer,
      concepto: "",
      monto: acuerdo.valorMensual,
      moneda: acuerdo.moneda,
      fechaPago,
      estado: "Pendiente",
      metodoPago: "Transferencia",
      comprobante: "",
      notas: "",
    });
  }
  return payments;
}

export default function PagosPage() {
  const { user } = useAuth();
  const { acuerdos } = useAcuerdos();
  const { pagos, isLoading, save, remove } = usePagos();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pago | null>(null);
  const [form, setForm] = useState(emptyPago());
  const [view, setView] = useState<ViewMode>("list");
  const [filterAcuerdo, setFilterAcuerdo] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const { sortItems, toggleSort } = useSort<Pago>();
  const [generating, setGenerating] = useState(false);
  const [alertShown, setAlertShown] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  // Check if user has gerencia or coordinador role
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["gerencia", "coordinador_mercadeo", "super_admin"])
      .then(({ data }) => {
        setCanDelete(!!data && data.length > 0);
      });
  }, [user]);

  // Alert for payments missing concepto
  useEffect(() => {
    if (!isLoading && pagos.length > 0 && !alertShown) {
      const sinConcepto = pagos.filter((p) => !p.concepto || p.concepto.trim() === "");
      if (sinConcepto.length > 0) {
        toast.warning(`Hay ${sinConcepto.length} pago(s) sin concepto registrado`, {
          description: "Ingresa a cada pago para completar el campo de concepto.",
          duration: 8000,
          icon: <AlertTriangle className="h-4 w-4" />,
        });
        setAlertShown(true);
      }
    }
  }, [isLoading, pagos, alertShown]);

  const pagoColumns: ColumnDef<Pago>[] = [
    { key: "influencer", label: "Influencer", sortKey: "influencer", render: (p) => <span className="font-medium">{p.influencer}</span> },
    { key: "concepto", label: "Concepto", sortKey: "concepto", render: (p) => p.concepto || <span className="text-amber-500 italic text-xs">Sin concepto</span> },
    { key: "monto", label: "Monto", sortKey: "monto", render: (p) => `$${p.monto.toLocaleString()}` },
    { key: "fechaPago", label: "Fecha Pago", sortKey: "fechaPago", render: (p) => p.fechaPago },
    { key: "metodoPago", label: "Método", sortKey: "metodoPago", render: (p) => p.metodoPago },
    { key: "estado", label: "Estado", sortKey: "estado", render: (p) => <Badge variant="secondary" className={estadoColors[p.estado]}>{p.estado}</Badge> },
  ];

  const { orderedColumns, draggedColumn, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useColumnOrder(pagoColumns);
  const { columnWidths, handleResizeStart } = useResizableColumns(orderedColumns.map(c => c.key), 120);
  const { isVisible, toggleColumn, showAll } = useColumnVisibility(orderedColumns.map(c => c.key));
  const visibleColumns = orderedColumns.filter(c => isVisible(c.key));
  const byAcuerdo = filterAcuerdo === "all" ? pagos : pagos.filter((p) => p.acuerdoId === filterAcuerdo);
  const byDate = filterByDateRange(byAcuerdo, dateRange, (p) => [p.fechaPago]);
  const filtered = sortItems(byDate, sortKey, sortDirection);

  const handleSort = (key: string) => {
    const result = toggleSort(key, sortKey, sortDirection);
    setSortKey(result.sortKey);
    setSortDirection(result.sortDirection);
  };

  const handleOpen = (p?: Pago) => {
    if (p) { setEditing(p); const { id, createdAt, ...rest } = p; setForm(rest); }
    else { setEditing(null); setForm(emptyPago()); }
    setOpen(true);
  };

  const handleSave = async () => {
    const selected = acuerdos.find((a) => a.id === form.acuerdoId);
    await save({ data: { ...form, influencer: selected?.influencer || form.influencer }, id: editing?.id });
    setOpen(false);
  };

  const handleDelete = async (id: string) => { await remove(id); };
  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleStatusChange = async (item: Pago, newStatus: string) => {
    const { id, createdAt, ...data } = item;
    await save({ data: { ...data, estado: newStatus as Pago["estado"] }, id });
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      for (const id of selectedIds) {
        await remove(id);
      }
      toast.success(`Se eliminaron ${selectedIds.size} pago(s)`);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error("Error al eliminar: " + (e?.message || "Error desconocido"));
    } finally {
      setDeleting(false);
    }
  };

  // Auto-generate payments from active agreements
  const handleGeneratePayments = async () => {
    const activeAcuerdos = acuerdos.filter((a) => a.estado === "Activo" || a.estado === "En Negociación");
    if (activeAcuerdos.length === 0) {
      toast.info("No hay acuerdos activos para generar pagos");
      return;
    }

    setGenerating(true);
    let created = 0;
    try {
      for (const acuerdo of activeAcuerdos) {
        const existingMonths = new Set(
          pagos.filter((p) => p.acuerdoId === acuerdo.id).map((p) => p.fechaPago?.slice(0, 7))
        );
        const newPayments = generatePaymentsForAcuerdo(acuerdo).filter(
          (p) => !existingMonths.has(p.fechaPago?.slice(0, 7))
        );
        for (const payment of newPayments) {
          await save({ data: payment });
          created++;
        }
      }
      if (created > 0) {
        toast.success(`Se generaron ${created} pago(s) automáticamente`);
      } else {
        toast.info("Todos los pagos ya están generados para los acuerdos activos");
      }
    } catch (e: any) {
      toast.error("Error al generar pagos: " + (e?.message || "Error desconocido"));
    } finally {
      setGenerating(false);
    }
  };

  const totalPagado = filtered.filter((p) => p.estado === "Pagado").reduce((s, p) => s + p.monto, 0);
  const totalPendiente = filtered.filter((p) => p.estado === "Pendiente").reduce((s, p) => s + p.monto, 0);

  const renderCard = (p: Pago) => (
    <div>
      <div className="font-semibold">{p.influencer}</div>
      <div className="text-muted-foreground text-xs">{p.concepto || <span className="text-amber-500 italic">Sin concepto</span>}</div>
      <div className="font-bold mt-1">${p.monto.toLocaleString()} {p.moneda}</div>
      <div className="text-xs text-muted-foreground">{p.metodoPago} · {p.fechaPago || "—"}</div>
    </div>
  );

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando pagos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Pagos</h1>
          <p className="text-white/80 text-sm">Control de pagos vinculados a acuerdos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGeneratePayments} disabled={acuerdos.length === 0 || generating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} /> Generar desde Acuerdos
          </Button>
          <Button variant="gradient" onClick={() => handleOpen()} disabled={acuerdos.length === 0}><Plus className="h-4 w-4 mr-2" /> Nuevo Pago</Button>
        </div>
      </div>

      {/* Bulk delete bar */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
          <span className="text-sm font-medium">{selectedIds.size} pago(s) seleccionado(s)</span>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4 mr-1" /> {deleting ? "Eliminando..." : "Eliminar seleccionados"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Deseleccionar</Button>
        </div>
      )}

      <ViewToolbar view={view} onViewChange={setView} acuerdos={acuerdos} selectedAcuerdo={filterAcuerdo} onAcuerdoChange={setFilterAcuerdo} dateRange={dateRange} onDateRangeChange={setDateRange} onExport={(fmt) => exportToFile(filtered, visibleColumns.map(c => ({ key: c.key, label: c.label })), fmt, "pagos")} columns={orderedColumns.map(c => ({ key: c.key, label: c.label }))} isColumnVisible={isVisible} onToggleColumn={toggleColumn} onShowAllColumns={showAll} />

      {acuerdos.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Primero debes crear un acuerdo en el módulo de Acuerdos antes de registrar pagos.</CardContent></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pagado</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">${totalPagado.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendiente</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">${totalPendiente.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Registros</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent></Card>
      </div>

      {view === "kanban" && (
        <KanbanBoard items={filtered} columns={kanbanColumns} getId={(p) => p.id} getStatus={(p) => p.estado} getValue={(p) => p.monto} renderCard={renderCard} onStatusChange={handleStatusChange} onCardClick={(p) => handleOpen(p)} />
      )}

      {view === "forecast" && (
        <ForecastBoard items={filtered} getDate={(p) => p.fechaPago} getValue={(p) => p.monto} renderCard={renderCard} getId={(p) => p.id} />
      )}

      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  {canDelete && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Seleccionar todos"
                      />
                    </TableHead>
                  )}
                  {visibleColumns.map((col) => (
                    <SortableTableHead
                      key={col.key}
                      label={col.label}
                      sortKey={col.sortKey || col.key}
                      currentSortKey={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, col.key)}
                      onDragOver={(e) => handleDragOver(e as any, col.key)}
                      onDrop={(e) => handleDrop(e as any, col.key)}
                      onDragEnd={handleDragEnd}
                      className={draggedColumn === col.key ? "opacity-50" : ""}
                      width={columnWidths[col.key]}
                      onResizeStart={(e) => handleResizeStart(e, col.key)}
                    />
                  ))}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={visibleColumns.length + 1 + (canDelete ? 1 : 0)} className="text-center py-8 text-muted-foreground">No hay pagos registrados.</TableCell></TableRow>
                ) : filtered.map((p) => (
                  <TableRow key={p.id} className={selectedIds.has(p.id) ? "bg-muted/40" : ""}>
                    {canDelete && (
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                          aria-label={`Seleccionar pago ${p.influencer}`}
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((col) => (
                      <TableCell key={col.key} className="truncate overflow-hidden" style={{ width: `${columnWidths[col.key]}px`, minWidth: `${columnWidths[col.key]}px`, maxWidth: `${columnWidths[col.key]}px` }}>{col.render(p)}</TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(p)}><Pencil className="h-4 w-4" /></Button>
                      {canDelete && <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Pago" : "Nuevo Pago"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Acuerdo (Influencer)</Label>
              <Select value={form.acuerdoId} onValueChange={(v) => update("acuerdoId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar acuerdo" /></SelectTrigger>
                <SelectContent>{acuerdos.map((a) => <SelectItem key={a.id} value={a.id}>{a.influencer} — {(Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).join(", ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Concepto</Label><Input value={form.concepto} onChange={(e) => update("concepto", e.target.value)} placeholder="Descripción del pago" /></div>
            <div className="space-y-2"><Label>Monto</Label><NumericInput value={form.monto} onChange={(v) => update("monto", v)} /></div>
            <div className="space-y-2"><Label>Moneda</Label><Select value={form.moneda} onValueChange={(v) => update("moneda", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Fecha Pago</Label><Input type="date" value={form.fechaPago} onChange={(e) => update("fechaPago", e.target.value)} /></div>
            <div className="space-y-2"><Label>Método de Pago</Label><Select value={form.metodoPago} onValueChange={(v) => update("metodoPago", v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="Transferencia">Transferencia</SelectItem><SelectItem value="Efectivo">Efectivo</SelectItem><SelectItem value="PayPal">PayPal</SelectItem><SelectItem value="Otro">Otro</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Estado</Label><Select value={form.estado} onValueChange={(v) => update("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Programado">Programado</SelectItem><SelectItem value="Pagado">Pagado</SelectItem><SelectItem value="Vencido">Vencido</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent></Select></div>
            <div className="col-span-2 space-y-2"><Label>Comprobante</Label><Input value={form.comprobante} onChange={(e) => update("comprobante", e.target.value)} placeholder="Referencia o número de comprobante" /></div>
            <div className="col-span-2 space-y-2"><Label>Notas</Label><Textarea value={form.notas} onChange={(e) => update("notas", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="gradient" onClick={handleSave}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
